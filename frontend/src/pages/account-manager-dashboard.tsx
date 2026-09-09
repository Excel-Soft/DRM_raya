import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { GmApprovalCard } from "@/components/gm-approval-card";
import { AccountsGmSummaryWidget } from "@/components/accounts-gm-summary-widget";
import { useToast } from "@/hooks/use-toast";
import {
    Users,
    CreditCard,
    Briefcase,
    FileText,
    TrendingUp,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Plus,
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    Wallet,
    Building2,
    Receipt,
    PieChart,
    ArrowRight,
    DollarSign,
    Check,
    X as XIcon,
    Calendar,
    Eye,
    X,
    Edit,
    PlusCircle,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InvoiceReceipt } from "@/components/invoice/InvoiceReceipt";
import { format, isToday, isSameMonth } from "date-fns";
import { AccountApprovalModal } from "@/components/account-approval-modal";

const DASHBOARD_PAGE_SIZE = 10;

export default function AccountManagerDashboard() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    // Defaults to "all" — a HOD-approved invoice waiting on a project doesn't
    // stop being actionable just because it wasn't approved today, so the
    // Create Project queue must not hide it by default.
    const [filterType, setFilterType] = useState<'all' | 'today' | 'monthly' | 'monthly-task' | 'martini-status'>('all');
    const [createProjectPage, setCreateProjectPage] = useState(1);
    const [invoicePage, setInvoicePage] = useState(1);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [selectedGm, setSelectedGm] = useState<any>(null);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalGm, setApprovalGm] = useState<any>(null);
    const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false);
    const [viewGm, setViewGm] = useState<any>(null);

    // Builds the shared InvoiceReceipt component's data shape from a GM pool
    // entry or a mapped invoice entry (see setViewGm call sites below) so both
    // "View" actions render the same canonical invoice design as HOD/Sales.
    const buildInvoiceReceiptData = (g: any) => {
        // Invoice-sourced rows (pending-quotations) don't carry a GM `packageType` —
        // their real name lives in `note` (project_name/notes/note, depending on
        // `source`), so that must be checked before falling back to the generic
        // 'Invoice' tag the view-click handler stamps on for all invoice rows.
        const sourceFallback = g?.source === "product_posting"
            ? "Alibaba Product Posting"
            : g?.source === "standard_invoice"
                ? "Standard Invoice"
                : g?.source === "quotation"
                    ? "Quotation"
                    : null;
        const pkgName = g?.packageType || g?.note || sourceFallback || g?.entryType || "Product Posting Service";
        const lowerPkg = pkgName.toLowerCase();
        let finalItemName = pkgName;
        let finalQty = 1;
        let finalDetail = g?.notes || `${g?.companyName || ""} Details`;
        if (lowerPkg.includes("minisite")) {
            finalItemName = "Alibaba Minisite Service";
            finalDetail = "1";
        } else if (lowerPkg.includes("listing")) {
            finalItemName = "Listing Page Service";
            finalDetail = "1";
        } else if (lowerPkg.includes("product posting")) {
            finalItemName = "Product Posting Service";
            finalQty = 100;
            finalDetail = "100";
        }
        const amountUsd = Number(g?.amountUsd) || 0;
        const amountPkr = Number(g?.amountPkr) || 0;
        return {
            invoiceNumber: g?.invoiceNumber || (g?.id ? g.id.toString().replace(/\D/g, "") : "9876"),
            date: g?.createdAt ? new Date(g.createdAt) : new Date(),
            from: {
                name: "Web Excels",
                whatsapp: "+92-334-8086611",
                phone: "+92-52-4271592",
                email: "Support@Webexcels.com",
                address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan.",
            },
            to: {
                name: g?.companyName || "-",
                phone: "-",
                email: "-",
                address: "Address:",
            },
            items: [
                {
                    name: finalItemName,
                    detail: finalDetail,
                    price: amountUsd,
                    quantity: finalQty,
                    total: amountUsd,
                },
            ],
            subTotalUsd: amountUsd,
            subTotalPkr: amountPkr,
            taxUsd: 0,
            discountPkr: 0,
            totalPkr: amountPkr,
        };
    };
    const [projectForm, setProjectForm] = useState({
        name: '',
        due: '0',
        amount: '',
        method: '',
        approvalStatus: 'approved',
        project: '',
    });

    const queryClient = useQueryClient();

    const [editInvoiceOpen, setEditInvoiceOpen] = useState(false);
    const [makeInvoiceModalOpen, setMakeInvoiceModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [invoiceForm, setInvoiceForm] = useState({
        status: "",
        receiptNumber: "",
        paymentMethod: ""
    });

    const updateInvoiceMutation = useMutation({
        mutationFn: async (data: any) => {
            let notesObj: any = {};
            try {
                if (data.invoice.notes) notesObj = JSON.parse(data.invoice.notes);
            } catch (e) {
                notesObj = { originalNote: data.invoice.notes };
            }

            const newNotes = JSON.stringify({
                ...notesObj,
                receiptNumber: data.receiptNumber,
                paymentMethod: data.paymentMethod
            });

            const res = await apiRequest("PATCH", `/api/account/invoices/${data.invoice.id}`, {
                status: data.status,
                notes: newNotes
            });
            if (!res.ok) throw new Error("Failed to update invoice");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["account-invoices-recent"] });
            queryClient.invalidateQueries({ queryKey: ["account-invoice-stats"] });
            toast({ title: "Success", description: "Invoice updated successfully" });
            setEditInvoiceOpen(false);
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to update invoice", variant: "destructive" });
        }
    });

    const handleEditInvoiceClick = (inv: any) => {
        setSelectedInvoice(inv);
        let receiptNumber = "";
        let paymentMethod = "";
        try {
            if (inv.notes) {
                const parsed = JSON.parse(inv.notes);
                receiptNumber = parsed.receiptNumber || "";
                paymentMethod = parsed.paymentMethod || "";
            }
        } catch (e) { }

        setInvoiceForm({
            status: inv.status || "Sent",
            receiptNumber,
            paymentMethod
        });
        setEditInvoiceOpen(true);
    };

    const submitInvoiceUpdate = () => {
        if (!selectedInvoice) return;
        updateInvoiceMutation.mutate({
            invoice: selectedInvoice,
            status: invoiceForm.status,
            receiptNumber: invoiceForm.receiptNumber,
            paymentMethod: invoiceForm.paymentMethod
        });
    };

    // Stats Overview period dropdown — same LD/WC/MC/QC/YC (Last Day/Week/Month/
    // Quarter/Year Cumulative) convention as the HOD dashboard's Top Selling
    // widget, kept independent of `filterType` above (which only scopes the
    // separate Create Project table).
    const STATS_PERIOD_DAYS: Record<string, number> = { LD: 1, WC: 7, MC: 30, QC: 90, YC: 365 };
    const [statsPeriod, setStatsPeriod] = useState("LD");

    const getStatsPeriodRange = (period: string) => {
        const days = STATS_PERIOD_DAYS[period] ?? 1;
        const now = new Date();
        const dateTo = new Date(now);
        const dateFrom = new Date(now);
        if (period === "LD") {
            dateFrom.setHours(0, 0, 0, 0);
        } else {
            dateFrom.setTime(now.getTime() - days * 24 * 60 * 60 * 1000);
        }
        const prevDateTo = new Date(dateFrom);
        const prevDateFrom = new Date(dateFrom.getTime() - days * 24 * 60 * 60 * 1000);
        return {
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            prevDateFrom: prevDateFrom.toISOString(),
            prevDateTo: prevDateTo.toISOString(),
        };
    };
    const statsRange = getStatsPeriodRange(statsPeriod);

    // Same GM-entry source of truth the AccountsGmSummaryWidget below already
    // uses (real amount_usd figures), instead of the near-empty legacy
    // drm.invoices table this row previously read from.
    const statsSummaryQuery = useQuery({
        queryKey: ["account-stats-summary", statsPeriod],
        queryFn: async () => {
            const res = await apiRequest(
                "GET",
                `/api/accounts/dashboard/gm-summary?dateFrom=${encodeURIComponent(statsRange.dateFrom)}&dateTo=${encodeURIComponent(statsRange.dateTo)}&recentLimit=1`
            );
            if (!res.ok) throw new Error("Failed to load stats summary");
            const body = await res.json();
            return body.data;
        },
    });

    const prevStatsSummaryQuery = useQuery({
        queryKey: ["account-stats-summary-prev", statsPeriod],
        queryFn: async () => {
            const res = await apiRequest(
                "GET",
                `/api/accounts/dashboard/gm-summary?dateFrom=${encodeURIComponent(statsRange.prevDateFrom)}&dateTo=${encodeURIComponent(statsRange.prevDateTo)}&recentLimit=1`
            );
            if (!res.ok) throw new Error("Failed to load previous stats summary");
            const body = await res.json();
            return body.data;
        },
    });

    const statsApprovedAmount = Number(
        statsSummaryQuery.data?.byStatus?.find((s: any) => s.status === "Approved")?.amount || 0
    );
    const prevStatsApprovedAmount = Number(
        prevStatsSummaryQuery.data?.byStatus?.find((s: any) => s.status === "Approved")?.amount || 0
    );
    const statsRevenueTrendPct = prevStatsApprovedAmount > 0
        ? ((statsApprovedAmount - prevStatsApprovedAmount) / prevStatsApprovedAmount) * 100
        : (statsApprovedAmount > 0 ? 100 : 0);
    const statsPendingEntry = statsSummaryQuery.data?.byStatus?.find((s: any) => s.status === "Pending");
    const statsPendingCount = statsPendingEntry?.count || 0;
    const statsPendingAmount = Number(statsPendingEntry?.amount || 0);

    const getDateRange = () => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        if (filterType === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (filterType === 'monthly' || filterType === 'monthly-task') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
        } else { // martini-status - show all or wider range
            start.setMonth(end.getMonth() - 2); // Last 2 months for Martini
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        }
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const gmStatsQuery = useQuery({
        queryKey: ["account-gm-stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/account/gm-entries/stats");
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        },
    });

    const invoiceStatsQuery = useQuery({
        queryKey: ["account-invoice-stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/account/invoices/stats");
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        },
    });

    const recentGMsQuery = useQuery({
        queryKey: ["account-gm-entries-recent", filterType],
        queryFn: async () => {
            const { start, end } = getDateRange();
            let url = `/api/account/gm-entries?dateFrom=${start}&dateTo=${end}`;

            // Add specific filter parameters if we had backend support
            // For now, we reuse the date range logic and client-side assumption
            // if (filterType === 'monthly-task') { url += `&type=monthly`; }

            const res = await apiRequest("GET", url);
            if (!res.ok) throw new Error("Failed to fetch GM entries");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const recentInvoicesQuery = useQuery({
        queryKey: ["account-invoices-recent"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/account/invoices");
            if (!res.ok) throw new Error("Failed to fetch invoices");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    useEffect(() => {
        setCreateProjectPage(1);
    }, [filterType]);

    // Pending quotations/invoices forwarded by HOD
    const pendingQuotationsQuery = useQuery({
        queryKey: ["account-pending-quotations"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/account/pending-quotations?limit=20");
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        refetchInterval: 30000,
    });

    const processQuotationMutation = useMutation({
        // Fixed 2026-07-21 (D-015): this never checked res.ok before returning
        // res.json() as the mutation's "result" -- a 403/404/500 error body was
        // silently treated as success, so onSuccess fired ("Invoice Approved ✅")
        // even when the Account Manager's approval was rejected server-side and
        // nothing in the database actually changed. Matches the pattern
        // createProjectFromGmMutation (below) already used correctly.
        mutationFn: async ({ id, action, note, amount, paymentMethod, receiptNumber, projectName }: {
            id: string;
            action: "approve" | "reject";
            note?: string;
            amount?: string;
            paymentMethod?: string;
            receiptNumber?: string;
            projectName?: string;
        }) => {
            const res = await apiRequest("POST", `/api/account/pending-quotations/${id}/approve`, {
                action,
                note,
                amount,
                paymentMethod,
                receiptNumber,
                projectName
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                // Fixed 2026-07-21 (D-016): errorData.error is not always a string --
                // this codebase's error envelope is sometimes {error:{message,code}}
                // (the "Stage 10" shape used by ApiError/sendError) and sometimes the
                // legacy {error:"some string"} shape. Passing the object form straight
                // into `new Error(...)` stringifies it to the literal text
                // "[object Object]" (matches auth.tsx's existing unwrapping for the
                // same reason). Unwrap both shapes before throwing.
                const message =
                    errorData?.details ||
                    errorData?.error?.message ||
                    (typeof errorData?.error === "string" ? errorData.error : "") ||
                    errorData?.message ||
                    `Failed to ${action} invoice`;
                throw new Error(message);
            }
            return res.json();
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["account-pending-quotations"] });
            toast({ title: vars.action === "approve" ? "Invoice Approved ✅" : "Invoice Rejected", description: vars.action === "approve" ? "Invoice has been approved successfully." : "Invoice has been rejected." });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" }),
    });

    const createProjectFromGmMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/account/create-project-from-gm", data);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || "Failed to create project");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Project created and Sales Executive notified ✅" });
            setCreateProjectOpen(false);
            setLocation("/pms/approvals");
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to create project", variant: "destructive" });
        }
    });

    const handleSaveProject = () => {
        if (!selectedGm) return;

        const action = projectForm.approvalStatus === 'rejected' ? 'reject' : 'approve';

        if (selectedGm.entrySource === 'invoice') {
            processQuotationMutation.mutate({
                id: selectedGm.id,
                action,
                amount: projectForm.amount,
                paymentMethod: projectForm.method,
                projectName: projectForm.name
            });
            setCreateProjectOpen(false);
        } else {
            createProjectFromGmMutation.mutate({
                gmId: selectedGm.id,
                projectName: projectForm.name,
                dueAmount: Number(projectForm.due),
                totalAmount: Number(projectForm.amount),
                paymentMethod: projectForm.method,
                approvalStatus: projectForm.approvalStatus
            });
        }
    };

    const StatCard = ({ title, value, subValue, icon: Icon, trend, trendValue, colorClass }: any) => (
        <Card className="overflow-hidden border-none shadow-md bg-white hover:shadow-lg transition-shadow dark:bg-zinc-900">
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className={`p-2 rounded-full ${colorClass} bg-opacity-10`}>
                        <Icon className={`h-4 w-4 ${colorClass.replace('bg-', 'text-')}`} />
                    </div>
                </div>
                <div className="flex items-baseline space-x-2">
                    <div className="text-2xl font-bold">{value}</div>
                    {subValue && <span className="text-xs text-muted-foreground">({subValue})</span>}
                </div>
                {trend && (
                    <div className="flex items-center mt-2 text-xs">
                        {trend === 'up' ? (
                            <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                        ) : (
                            <ArrowDownRight className="h-3 w-3 text-rose-500 mr-1" />
                        )}
                        <span className={trend === 'up' ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}>
                            {trendValue}
                        </span>
                        <span className="text-muted-foreground ml-1">vs last month</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const ActionCard = ({ icon: Icon, title, description, href, color }: any) => (
        <Link href={href}>
            <div className="group relative overflow-hidden rounded-xl border bg-white p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer dark:bg-zinc-900">
                <div className={`absolute right-2 top-2 h-16 w-16 -translate-y-4 translate-x-4 rounded-full ${color} opacity-10 group-hover:scale-150 transition-transform`} />
                <div className="relative flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} bg-opacity-20`}>
                        <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
                        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                    </div>
                </div>
            </div>
        </Link>
    );

    const ActivityProgress = ({ label, value, total, color }: any) => (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-zinc-400">{label}</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">{value}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                <div
                    className={`h-full ${color} rounded-full`}
                    style={{ width: `${Math.min((value / total) * 100, 100)}%` }}
                />
            </div>
        </div>
    );

    const QuickLink = ({ label, href, badge, badgeColor, onClick }: any) => {
        const content = (
            <div onClick={onClick} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 hover:bg-white hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer group dark:bg-zinc-900 dark:hover:bg-zinc-800">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-sm font-medium text-slate-700 group-hover:text-primary truncate dark:text-zinc-400">{label}</span>
                    {badge && <span className={`text-[10px] ${badgeColor} font-normal truncate`}>{badge}</span>}
                </div>
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-transform" />
            </div>
        );
        return href ? <Link href={href}>{content}</Link> : content;
    };

    // Helper for button styles
    const getButtonStyle = (isActive: boolean) =>
        `h-9 font-medium border transition-colors ${isActive
            ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm'
            : 'bg-slate-100 text-slate-700 border-emerald-500 hover:bg-slate-200'
        }`;

    // "Create Project" section: ONLY pending invoices (GM entries excluded per requirement)
    const createProjectPendingInvoices = Array.isArray(pendingQuotationsQuery.data?.data)
        ? pendingQuotationsQuery.data.data.map((q: any) => ({ ...q, entrySource: 'invoice' }))
        : [];
    const createProjectCombined = createProjectPendingInvoices;
    const createProjectFilteredItems = createProjectCombined.filter((item: any) => {
        if (filterType === 'all') return true;
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (filterType === 'today') return isToday(itemDate);
        if (filterType === 'monthly' || filterType === 'monthly-task') return isSameMonth(itemDate, new Date());
        return true;
    });
    const createProjectTotalPages = Math.max(1, Math.ceil(createProjectFilteredItems.length / DASHBOARD_PAGE_SIZE));
    const createProjectCurrentPage = Math.min(createProjectPage, createProjectTotalPages);
    const createProjectPagedItems = createProjectFilteredItems.slice(
        (createProjectCurrentPage - 1) * DASHBOARD_PAGE_SIZE,
        createProjectCurrentPage * DASHBOARD_PAGE_SIZE
    );

    // "Invoice" (Customer Monthly) section: paginate recent invoices
    const invoiceItems = Array.isArray(recentInvoicesQuery.data) ? recentInvoicesQuery.data : [];
    const invoiceTotalPages = Math.max(1, Math.ceil(invoiceItems.length / DASHBOARD_PAGE_SIZE));
    const invoiceCurrentPage = Math.min(invoicePage, invoiceTotalPages);
    const invoicePagedItems = invoiceItems.slice(
        (invoiceCurrentPage - 1) * DASHBOARD_PAGE_SIZE,
        invoiceCurrentPage * DASHBOARD_PAGE_SIZE
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950 space-y-8 p-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Account Manager</h1>
                    <p className="text-muted-foreground mt-1">
                        Welcome back. Here's your financial overview for today.
                    </p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide dark:text-zinc-400">Overview</h2>
                <Select value={statsPeriod} onValueChange={setStatsPeriod}>
                    <SelectTrigger className="w-[80px] h-8 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                        <SelectValue placeholder="LD" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="LD">LD</SelectItem>
                        <SelectItem value="WC">WC</SelectItem>
                        <SelectItem value="MC">MC</SelectItem>
                        <SelectItem value="QC">QC</SelectItem>
                        <SelectItem value="YC">YC</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Revenue"
                    value={`$${statsApprovedAmount.toLocaleString()}`}
                    icon={TrendingUp}
                    colorClass="bg-emerald-500 text-emerald-500"
                    trend={statsRevenueTrendPct >= 0 ? "up" : "down"}
                    trendValue={`${statsRevenueTrendPct >= 0 ? "+" : ""}${statsRevenueTrendPct.toFixed(1)}%`}
                />
                <StatCard
                    title="Outstanding Invoices"
                    value={statsPendingCount}
                    subValue={`$${statsPendingAmount.toLocaleString()}`}
                    icon={AlertCircle}
                    colorClass="bg-amber-500 text-amber-500"
                />
                <StatCard
                    title="Active Projects"
                    value={statsSummaryQuery.data?.totals?.totalGmCount ?? 0}
                    icon={Briefcase}
                    colorClass="bg-blue-500 text-blue-500"
                />
                <StatCard
                    title="Total Clients"
                    value={statsSummaryQuery.data?.totals?.distinctClientCount ?? 0}
                    icon={Users}
                    colorClass="bg-violet-500 text-violet-500"
                />
            </div>

            {/* Patch 5 Stage 7 — GM type / invoice overview */}
            <AccountsGmSummaryWidget onCreateProject={(gm) => {
                setApprovalGm(gm);
                setApprovalModalOpen(true);
            }} />

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Main Content Area (2 Cols) */}
                <div className="lg:col-span-2 space-y-8">
                    
                    <AccountApprovalModal 
                        open={approvalModalOpen}
                        onOpenChange={setApprovalModalOpen}
                        gmEntry={approvalGm}
                    />

                    {/* Create Project Section */}
                    <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
                        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
                            <CardTitle className="text-xl font-bold text-slate-800 dark:text-zinc-100">Create Project</CardTitle>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={filterType === 'all' ? 'default' : 'ghost'}
                                        onClick={() => setFilterType('all')}
                                        className={filterType === 'all' ? 'bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-md' : 'text-slate-600 dark:text-slate-300 h-10 px-4'}
                                    >
                                        All
                                    </Button>
                                    <Button
                                        variant={filterType === 'today' ? 'default' : 'ghost'}
                                        onClick={() => setFilterType('today')}
                                        className={filterType === 'today' ? 'bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-md' : 'text-slate-600 dark:text-slate-300 h-10 px-4'}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        variant={filterType === 'monthly' ? 'default' : 'ghost'}
                                        onClick={() => setFilterType('monthly')}
                                        className={filterType === 'monthly' ? 'bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-md' : 'text-slate-600 dark:text-slate-300 h-10 px-4'}
                                    >
                                        Monthly
                                    </Button>
                                    <Button
                                        variant={filterType === 'monthly-task' ? 'default' : 'ghost'}
                                        onClick={() => setFilterType('monthly-task')}
                                        className={filterType === 'monthly-task' ? 'bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-md' : 'text-slate-600 dark:text-slate-300 h-10 px-4'}
                                    >
                                        Monthly Task
                                    </Button>
                                </div>
                                <div
                                    onClick={() => setFilterType('martini-status')}
                                    className="flex items-center gap-1.5 cursor-pointer group"
                                >
                                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Martini Status</span>
                                    <div className="flex items-center justify-center bg-rose-500 text-white w-5 h-5 rounded-full text-[10px] font-bold">
                                        {createProjectFilteredItems.length}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-100/50">
                                    <TableRow>
                                        <TableHead className="w-[60px] font-bold text-slate-700 dark:text-zinc-400">No</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Inv ID</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Sale Person</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Create</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Payment</TableHead>
                                        <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Hod</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        return createProjectPagedItems.map((item: any, index: number) => {
                                            const isInvoice = item.entrySource === 'invoice';
                                            return (
                                                <TableRow key={item.id} className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800 ${isInvoice ? 'border-l-4 border-l-purple-400' : 'border-l-4 border-l-blue-400'}`}>
                                                    <TableCell className="font-medium text-slate-600 dark:text-zinc-300">{(createProjectCurrentPage - 1) * DASHBOARD_PAGE_SIZE + index + 1}</TableCell>
                                                    <TableCell className="text-slate-600 font-medium dark:text-zinc-300">
                                                        {isInvoice
                                                            ? (item.invoiceNumber || item.orderId || item.id.toString().substring(0, 4))
                                                            : (item.orderId || item.id.toString().substring(0, 4))}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isInvoice ? (
                                                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[11px] font-semibold hover:bg-purple-100">📄 Invoice</Badge>
                                                        ) : (
                                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[11px] font-semibold hover:bg-blue-100">📊 GM</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-700 dark:text-zinc-400">
                                                        {isInvoice ? item.company : item.companyName}
                                                        {(isInvoice || (item.status === "HOD Approved")) && (
                                                            <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100 border-amber-200 text-amber-700">HOD Approved</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 dark:text-zinc-300">
                                                        {item.salesPersonName || item.submittedByName || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 dark:text-zinc-300">
                                                        {format(new Date(item.createdAt), "MM/dd/yyyy hh:mm a")}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 font-medium text-center dark:text-zinc-300">
                                                        {isInvoice 
                                                            ? (item.grandTotal || 0)
                                                            : (item.amountPkr 
                                                                ? item.amountPkr 
                                                                : (item.amountUsd ? item.amountUsd : "0"))
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col gap-1 items-center justify-center">
                                                            <span className="text-emerald-600 font-medium">Approved</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-2">
                                                            {isInvoice ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            // Prepare viewGm state to handle invoice data format
                                                                            setViewGm({
                                                                                ...item,
                                                                                companyName: item.company,
                                                                                amountUsd: item.grandTotal,
                                                                                amountPkr: item.amountPkr || 0,
                                                                                salesPersonName: item.salesPersonName,
                                                                                createdAt: item.createdAt,
                                                                                entryType: 'Invoice'
                                                                            });
                                                                            setViewInvoiceOpen(true);
                                                                        }}
                                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                        title="View Invoice"
                                                                    >
                                                                        <Eye className="h-5 w-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedGm({...item, entrySource: 'invoice'});
                                                                            setProjectForm({
                                                                                name: item.company,
                                                                                due: "0",
                                                                                amount: item.grandTotal?.toString() || "",
                                                                                method: "",
                                                                                approvalStatus: 'approved',
                                                                                project: item.source === 'product_posting' ? 'Alibaba Product Posting' : (item.source === 'standard_invoice' ? 'Standard Invoice Project' : 'Project from Quotation')
                                                                            });
                                                                            setCreateProjectOpen(true);
                                                                        }}
                                                                        disabled={processQuotationMutation.isPending}
                                                                        className="text-rose-500 hover:text-rose-600 transition-colors"
                                                                        title="Create Project"
                                                                    >
                                                                        <PlusCircle className="h-5 w-5" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setViewGm(item);
                                                                            setViewInvoiceOpen(true);
                                                                        }}
                                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                    >
                                                                        <Eye className="h-5 w-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedGm({...item, entrySource: 'gm'});
                                                                            setProjectForm(prev => ({
                                                                                ...prev,
                                                                                name: item.companyName,
                                                                                due: "0",
                                                                                amount: "",
                                                                                method: "",
                                                                                approvalStatus: 'approved'
                                                                            }));
                                                                            setCreateProjectOpen(true);
                                                                        }}
                                                                        className={`${(Number(item.isPartialPayment || item.is_partial_payment) !== 1 && Number(item.isLoan || item.is_loan) !== 1 && item.status !== 'Partial') ? 'text-emerald-500 hover:text-emerald-600' : 'text-rose-500 hover:text-rose-600'} transition-colors`}
                                                                        title="Paid"
                                                                    >
                                                                        <PlusCircle className="h-5 w-5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })()}
                                    {createProjectFilteredItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-slate-400 py-8">No pending entries found for project creation</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="flex items-center justify-between px-6 py-3 border-t">
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Page {createProjectCurrentPage} of {createProjectTotalPages} · {createProjectFilteredItems.length} entries
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCreateProjectPage((p) => Math.max(1, p - 1))}
                                        disabled={createProjectCurrentPage <= 1}
                                        data-testid="button-create-project-prev-page"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCreateProjectPage((p) => Math.min(createProjectTotalPages, p + 1))}
                                        disabled={createProjectCurrentPage >= createProjectTotalPages}
                                        data-testid="button-create-project-next-page"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer Monthly Table */}
                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Customer Monthly</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select defaultValue="rec">
                                    <SelectTrigger className="w-[80px] h-8">
                                        <SelectValue placeholder="REC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="rec">REC</SelectItem>
                                        <SelectItem value="gm">GM</SelectItem>
                                        <SelectItem value="bv">BV</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Recept</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Create</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoicePagedItems.map((inv: any) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        const p = JSON.parse(inv.notes);
                                                        return p.receiptNumber || '-';
                                                    } catch (e) { return '-'; }
                                                })()}
                                            </TableCell>
                                            <TableCell>{parseFloat(inv.total).toLocaleString()} {inv.currency || 'USD'}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        const p = JSON.parse(inv.notes);
                                                        return p.paymentMethod || '-';
                                                    } catch (e) { return '-'; }
                                                })()}
                                            </TableCell>
                                            <TableCell><Badge variant="outline" className={inv.status === 'Paid' ? 'border-emerald-500 text-emerald-600' : inv.status === 'Overdue' ? 'border-rose-500 text-rose-600' : 'border-amber-500 text-amber-600'}>{inv.status}</Badge></TableCell>
                                            <TableCell>{format(new Date(inv.issueDate), "MM/dd/yyyy hh:mm a")}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEditInvoiceClick(inv)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                    }
                                    {invoiceItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-slate-400 py-8">No invoices found</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="flex items-center justify-between pt-3 border-t">
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Page {invoiceCurrentPage} of {invoiceTotalPages} · {invoiceItems.length} entries
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                                        disabled={invoiceCurrentPage <= 1}
                                        data-testid="button-invoice-prev-page"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                                        disabled={invoiceCurrentPage >= invoiceTotalPages}
                                        data-testid="button-invoice-next-page"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* Right Sidebar (1 Col) */}
                <div className="space-y-6">

                    {/* Quick Actions Grid */}
                    <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
                        <CardHeader>
                            <CardTitle>Quick Entries</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                <QuickLink label="Daily Closing" href="#" badge="Under Development" badgeColor="text-red-500" />
                                <QuickLink label="Dollar System" href="/account/dollar-system" />
                                <QuickLink label="Ab Closing Report" href="/account/ab-report" />
                                <QuickLink label="Add Gm" href="/gm-pool/add-gm" />
                                <QuickLink label="Make Invoice" href="/account/invoices" />
                                <QuickLink label="Ledger" href="/account/ledger" />
                                <QuickLink label="Office Vas" href="/office/vas" />
                                <QuickLink label="Expense" href="/office/expenses" />
                                <QuickLink label="Set Target" href="/target-system/set" />
                                <QuickLink label="Salary Create" href="#" />
                                <QuickLink label="Salary Report" href="#" />
                                <QuickLink label="Attendance" href="/hr/attendance" />
                                <QuickLink label="Vas Report" href="/reports/vas/new" />
                                <QuickLink label="Gm Checking" href="/account/gm-entries" />
                                <QuickLink label="BV Checking" href="/reports/bv/new" />
                                <QuickLink label="Add Penalty" href="#" />
                                <QuickLink label="Over Time" href="/hr/overtime" />
                                <QuickLink label="Loan Application" href="/hr/loan" />
                                <QuickLink label="Due Payment" href="/account/invoices" />
                                <QuickLink label="Commission Verification" href="#" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* GM Approvals */}
                    <GmApprovalCard role="account-manager" />

                    {/* Attendance Widget */}
                    <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle>Attendance</CardTitle>
                            <Plus className="h-5 w-5 text-emerald-500 cursor-pointer hover:bg-emerald-50 rounded-full p-0.5" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                                <div className="flex items-center gap-1">
                                    <ArrowRight className="h-4 w-4" />
                                    <span>Last Date</span>
                                </div>
                                <span className="ml-auto font-medium text-slate-900 dark:text-zinc-100">{format(new Date(), "yyyy-MM-dd")}</span>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Important Info Widget */}
                    <div className="bg-white rounded-lg border shadow-sm p-4 text-left cursor-default dark:bg-zinc-900">
                        <h2 className="text-[15px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important Metrics</h2>
                        <div className="space-y-4">
                            {[
                                { label: "Dollar Rate", value: recentGMsQuery.data?.find((g: any) => g.dollarRate)?.dollarRate || '-', icon: DollarSign, bg: "bg-emerald-100", text: "text-emerald-600", href: "#" },
                                { label: "Monthly Gm", value: recentGMsQuery.data?.length || 0, icon: Briefcase, bg: "bg-blue-100", text: "text-blue-600", href: "/account/gm-entries" },
                                { label: "Total Gm", value: gmStatsQuery.data?.totalCount || 0, icon: Clock, bg: "bg-slate-100", text: "text-slate-600 dark:text-slate-300", href: "/account/gm-entries" },
                                { label: "Pending GM", value: gmStatsQuery.data?.pendingCount || 0, icon: TrendingUp, bg: "bg-violet-100", text: "text-violet-600", href: "/account/gm-entries" },
                                { label: "Loans", value: gmStatsQuery.data?.loanCount || 0, icon: Calendar, bg: "bg-rose-100", text: "text-rose-600", href: "/account/gm-entries" },
                                { label: "Partial Pay", value: gmStatsQuery.data?.partialPaymentCount || 0, icon: AlertCircle, bg: "bg-red-100", text: "text-red-600", href: "/account/gm-entries" },
                                { label: "Invoices", value: invoiceStatsQuery.data?.totalCount || 0, icon: FileText, bg: "bg-orange-100", text: "text-orange-600", href: "/account/invoices" },
                                { label: "Paid Inv", value: invoiceStatsQuery.data?.paidCount || 0, icon: Users, bg: "bg-indigo-100", text: "text-indigo-600", href: "/account/invoices" },
                            ].map((stat, rowIndex) => (
                                <div key={rowIndex} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                                    <Link href={stat.href} className="flex flex-1 justify-between text-[13px] hover:opacity-80 transition-opacity">
                                        <span className="text-gray-600 font-medium dark:text-zinc-300">{stat.label}</span>
                                        <span className="text-gray-900 font-bold dark:text-zinc-100">{stat.value}</span>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activities Widget */}
                    <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle>Activities</CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">TD</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ActivityProgress label="GM" value={recentGMsQuery.data?.length || 0} total={gmStatsQuery.data?.totalCount || 1} color="bg-emerald-500" />
                            <ActivityProgress label="Pending GM" value={gmStatsQuery.data?.pendingCount || 0} total={gmStatsQuery.data?.totalCount || 1} color="bg-amber-500" />
                            <ActivityProgress label="Invoice" value={invoiceStatsQuery.data?.totalCount || 0} total={Math.max(invoiceStatsQuery.data?.totalCount || 1, 1)} color="bg-emerald-500" />
                            <ActivityProgress label="Paid" value={invoiceStatsQuery.data?.paidCount || 0} total={Math.max(invoiceStatsQuery.data?.totalCount || 1, 1)} color="bg-slate-50 dark:bg-zinc-9000" />
                            <ActivityProgress label="Overdue" value={invoiceStatsQuery.data?.overdueCount || 0} total={Math.max(invoiceStatsQuery.data?.totalCount || 1, 1)} color="bg-rose-500" />
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Create Project Modal */}
            <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 gap-0 rounded-xl overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="text-2xl font-semibold text-slate-800 flex items-center gap-2 dark:text-zinc-100">
                            Create Project — <span className="text-emerald-400 font-medium text-lg">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
                        </DialogTitle>
                        <DialogDescription className="sr-only">Create a new project entry</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        {/* Name & Due */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Name</Label>
                                <Input
                                    value={projectForm.name}
                                    readOnly
                                    className="bg-slate-100 border-slate-200 h-11 cursor-not-allowed focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Due</Label>
                                <Input
                                    value={projectForm.due}
                                    readOnly
                                    className="bg-slate-100 border-slate-200 h-11 cursor-not-allowed focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900"
                                />
                            </div>
                        </div>

                        {/* Amount, Method, Receipt Number */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Amount</Label>
                                <Input
                                    value={projectForm.amount}
                                    onChange={(e) => setProjectForm(prev => ({ ...prev, amount: e.target.value }))}
                                    className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                                    placeholder=""
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Method</Label>
                                <Select
                                    value={projectForm.method}
                                    onValueChange={(val) => setProjectForm(prev => ({ ...prev, method: val }))}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose ..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="bank-transfar">Bank Transfar</SelectItem>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="delay">Delay</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Status</Label>
                                <Select
                                    value={projectForm.approvalStatus}
                                    onValueChange={(val) => setProjectForm(prev => ({ ...prev, approvalStatus: val }))}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="Select status ..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="approved">
                                            <span className="flex items-center gap-2 text-emerald-600 font-semibold">✅ Approved</span>
                                        </SelectItem>
                                        <SelectItem value="rejected">
                                            <span className="flex items-center gap-2 text-rose-600 font-semibold">❌ Rejected</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Project */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Project</Label>
                                <Badge className="bg-rose-100 text-rose-500 rounded px-1.5 py-0 text-[10px] font-bold border-none">1</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-md bg-white min-h-[48px] dark:bg-zinc-900 dark:border-zinc-800">
                                {selectedGm && (
                                    <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 text-sm text-blue-700 font-medium">
                                        <button
                                            onClick={() => setSelectedGm(null)}
                                            className="text-blue-400 hover:text-blue-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                        Alibaba Product Posting (0)-(0)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-4 border-t gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCreateProjectOpen(false)}
                            className="px-6"
                        >
                            Close
                        </Button>
                        <Button
                            className={`text-white px-6 ${
                                projectForm.approvalStatus === 'rejected'
                                    ? 'bg-rose-600 hover:bg-rose-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                            onClick={handleSaveProject}
                            disabled={createProjectFromGmMutation.isPending || !selectedGm}
                        >
                            {createProjectFromGmMutation.isPending
                                ? (projectForm.approvalStatus === 'rejected' ? "Rejecting..." : "Approving...")
                                : (projectForm.approvalStatus === 'rejected' ? "Reject" : "Approve")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invoice View Modal */}
            <Dialog open={viewInvoiceOpen} onOpenChange={setViewInvoiceOpen}>
                <DialogContent className="max-w-[750px] p-0 border-none bg-transparent shadow-none max-h-[95vh] overflow-y-auto thin-scrollbar">
                    <DialogDescription className="sr-only">Invoice details view</DialogDescription>
                    {viewGm && (
                        <InvoiceReceipt
                            invoiceData={buildInvoiceReceiptData(viewGm)}
                            onClose={() => setViewInvoiceOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Edit Invoice Modal */}
            <Dialog open={editInvoiceOpen} onOpenChange={setEditInvoiceOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Update Invoice Details</DialogTitle>
                        <DialogDescription>Verify, add receipt number, and update payment status.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={invoiceForm.status || ''} onValueChange={(val) => setInvoiceForm(prev => ({ ...prev, status: val }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Sent">Sent (Verified)</SelectItem>
                                    <SelectItem value="Paid">Paid</SelectItem>
                                    <SelectItem value="Overdue">Overdue</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Receipt / Reference Number</Label>
                            <Input
                                placeholder="Enter receipt NO..."
                                value={invoiceForm.receiptNumber}
                                onChange={(e) => setInvoiceForm(prev => ({ ...prev, receiptNumber: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <Select value={invoiceForm.paymentMethod || ''} onValueChange={(val) => setInvoiceForm(prev => ({ ...prev, paymentMethod: val }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                    <SelectItem value="Online">Online</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditInvoiceOpen(false)}>Cancel</Button>
                        <Button onClick={submitInvoiceUpdate} disabled={updateInvoiceMutation.isPending}>
                            {updateInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
