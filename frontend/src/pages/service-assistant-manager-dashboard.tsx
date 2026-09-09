import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson, getAuthHeader } from "@/lib/queryClient";
import { Users, Tag, Target, ArrowRightLeft, ChevronRight, ChevronLeft, Plus, Play, Check, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ServiceQuickEntriesCard } from "@/components/service-quick-entries-card";
import { InServiceModal } from "@/components/in-service-modal";

type ServiceDashboardCounts = {
    grades?: { A?: number; B_PLUS?: number; B?: number; B_MINUS?: number };
    complaints?: { open?: number; in_progress?: number; resolved?: number; closed?: number };
    dueFollowups?: number;
    dropouts?: number;
    duePayments?: number;
    documents?: { bv?: number; vas?: number };
};

type ServiceManagerStats = {
    totalRevenue?: number;
    new?: number;
    renew?: number;
    expire?: number;
    inService?: number;
    kwa?: number;
    psa?: number;
    sponsorBrand?: number;
};

type ActivitiesStats = {
    methodCounts: Record<string, number>;
    methodTargets: Record<string, { target: number; achieved: number }>;
    totalMinutes: number;
};

type VasTarget = {
    achieved: number;
    target: number;
    percent: number;
};

type PipelineCustomerRow = {
    id: string;
    drmId: string | null;
    company: string | null;
    account: string | null;
    email: string | null;
    phone: string | null;
    grade: string | null;
    createdAt: string;
};

type MonthlyCustomerRow = {
    id: string;
    drmId: string | null;
    company: string | null;
    accountName: string | null;
    email: string | null;
    phone: string | null;
    ntn: string | null;
    cnic: string | null;
    grade: string | null;
    createdAt: string;
    followCount: number;
};

type CustomerSearchResult = {
    id: string;
    companyName: string;
    accountName: string | null;
    drmId?: string | null;
};

function CompanySearchSelect({
    value,
    onChange,
    placeholder,
}: {
    value: { id: string; label: string };
    onChange: (val: { id: string; label: string }) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 250);
        return () => clearTimeout(t);
    }, [search]);

    const { data: companies, isFetching } = useQuery<CustomerSearchResult[]>({
        queryKey: ["company-search-sam", debounced],
        queryFn: async () => {
            const res = await fetch(`/api/customers/search?q=${encodeURIComponent(debounced)}`, {
                headers: { ...getAuthHeader() },
                credentials: "include",
            });
            const json = await res.json();
            return (json.customers as CustomerSearchResult[]) || [];
        },
        staleTime: 30_000,
    });

    const options = companies || [];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                        "w-full h-10 justify-between font-normal border-slate-200 dark:border-zinc-800",
                        !value.label && "text-muted-foreground",
                    )}
                >
                    <span className="truncate">{value.label || placeholder || "Search Company Through Id/Name"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-[320px]">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search Company Through Id/Name" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{isFetching ? "Searching..." : "No company found."}</CommandEmpty>
                        <CommandGroup>
                            {options.map((c) => (
                                <CommandItem
                                    key={c.id}
                                    value={c.id}
                                    onSelect={() => {
                                        onChange({ id: c.id, label: c.companyName });
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", c.id === value.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{c.companyName}</span>
                                        {c.accountName ? <span className="text-xs text-muted-foreground">{c.accountName}</span> : null}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function ServiceAssistantManagerDashboard() {
    const [, setLocation] = useLocation();

    const { data: countsRes } = useQuery<ServiceDashboardCounts>({
        queryKey: ["/api/service/dashboard/counts"],
        queryFn: () => apiRequestJson<ServiceDashboardCounts>("GET", "/api/service/dashboard/counts"),
    });
    const counts = countsRes || {};

    const [topSellingPeriod, setTopSellingPeriod] = useState("WC");

    const { data: statsRes } = useQuery<ServiceManagerStats>({
        queryKey: ["/api/service/manager/stats", topSellingPeriod],
        queryFn: () => apiRequestJson<ServiceManagerStats>("GET", `/api/service/manager/stats?period=${topSellingPeriod}`),
    });
    const stats = statsRes || {};

    const [activitiesPeriod, setActivitiesPeriod] = useState("TD");
    const { data: activitiesRes } = useQuery<ActivitiesStats>({
        queryKey: ["/api/service/manager/activities", activitiesPeriod],
        queryFn: () => apiRequestJson<ActivitiesStats>("GET", `/api/service/manager/activities?period=${activitiesPeriod}`),
    });
    const activities = activitiesRes || { methodCounts: {}, methodTargets: {}, totalMinutes: 0 };

    const [vasPeriod] = useState("MONTH");
    const { data: vasRes } = useQuery<VasTarget>({
        queryKey: ["/api/service/manager/vas-target", vasPeriod],
        queryFn: () => apiRequestJson<VasTarget>("GET", `/api/service/manager/vas-target?period=${vasPeriod}`),
    });
    const vasTarget = vasRes || { achieved: 0, target: 0, percent: 0 };

    const [chartStage, setChartStage] = useState("ld");
    const [chartSearch, setChartSearch] = useState("");
    const [chartPageSize, setChartPageSize] = useState("10");
    const [chartPage, setChartPage] = useState(1);
    const { data: pipelineRes } = useQuery<{ rows: PipelineCustomerRow[]; notTracked: boolean }>({
        queryKey: ["/api/service/manager/pipeline-customers", chartStage],
        queryFn: () => apiRequestJson<{ rows: PipelineCustomerRow[]; notTracked: boolean }>("GET", `/api/service/manager/pipeline-customers?stage=${chartStage}`),
    });
    const pipelineRows = pipelineRes?.rows || [];
    const pipelineNotTracked = pipelineRes?.notTracked ?? false;
    const filteredPipelineRows = pipelineRows.filter((r) => {
        if (!chartSearch) return true;
        const q = chartSearch.toLowerCase();
        return [r.company, r.account, r.email, r.phone].some((f) => (f || "").toLowerCase().includes(q));
    });
    const chartPageSizeNum = Number(chartPageSize);
    const pagedPipelineRows = filteredPipelineRows.slice((chartPage - 1) * chartPageSizeNum, chartPage * chartPageSizeNum);
    const chartTotalPages = Math.max(1, Math.ceil(filteredPipelineRows.length / chartPageSizeNum));

    const [customerMonthlyFilter, setCustomerMonthlyFilter] = useState<'gm' | 'bv'>('gm');
    const { data: monthlyCustomersRes } = useQuery<MonthlyCustomerRow[]>({
        queryKey: ["/api/service/manager/customers", customerMonthlyFilter],
        queryFn: () => apiRequestJson<MonthlyCustomerRow[]>("GET", `/api/service/manager/customers?type=${customerMonthlyFilter}`),
    });
    const monthlyCustomers = monthlyCustomersRes || [];
    const [inServiceModalOpen, setInServiceModalOpen] = useState(false);
    const [targetView, setTargetView] = useState<'overall' | 't-ab' | 't-vas'>('overall');
    const [displayAllActive, setDisplayAllActive] = useState(true);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        Account: true,
        Email: true,
        Phone: true,
        NTN: true,
        Grade: true,
    });

    const handleDisplayAll = () => {
        setDisplayAllActive(true);
        setVisibleColumns({
            Account: true,
            Email: true,
            Phone: true,
            NTN: true,
            Grade: true,
        });
    };

    const toggleColumn = (col: string) => {
        const updated = { ...visibleColumns, [col]: !visibleColumns[col] };
        setVisibleColumns(updated);
        setDisplayAllActive(Object.values(updated).every(Boolean));
    };

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [followCompanySel, setFollowCompanySel] = useState<{ id: string; label: string }>({ id: '', label: '' });
    const [followPurpose, setFollowPurpose] = useState('');
    const [followMethod, setFollowMethod] = useState('');
    const [followNextDate, setFollowNextDate] = useState('');
    const [followNote, setFollowNote] = useState('');

    const { data: followLookupRes, isFetching: followLookupLoading } = useQuery<{ serviceCustomerId: string | null }>({
        queryKey: ["service-customer-lookup", followCompanySel.id],
        queryFn: () => apiRequestJson<{ serviceCustomerId: string | null }>("GET", `/api/service/followups/service-customer-lookup?customerId=${followCompanySel.id}`),
        enabled: !!followCompanySel.id,
    });
    const followServiceCustomerId = followLookupRes?.serviceCustomerId ?? null;

    const { data: teamExecutivesRes } = useQuery<{ id: string; name: string; roleId: string }[]>({
        queryKey: ["/api/service/manager/team-executives"],
        queryFn: () => apiRequestJson<{ id: string; name: string; roleId: string }[]>("GET", "/api/service/manager/team-executives"),
    });
    const teamExecutives = teamExecutivesRes || [];
    const [onboardAssignee, setOnboardAssignee] = useState('');

    const onboardMutation = useMutation({
        mutationFn: () => apiRequestJson("POST", "/api/service/customers", {
            customerId: followCompanySel.id,
            status: "active",
            serviceStartDate: new Date().toISOString(),
            assignedTo: onboardAssignee || undefined,
        }),
        onSuccess: () => {
            toast({ title: "Company onboarded to the service module" });
            queryClient.invalidateQueries({ queryKey: ["service-customer-lookup", followCompanySel.id] });
            setOnboardAssignee('');
        },
        onError: (err: any) => {
            toast({ title: "Failed to onboard company", description: err?.message, variant: "destructive" });
        },
    });

    const createFollowupMutation = useMutation({
        mutationFn: () => {
            if (!followServiceCustomerId) {
                throw new Error("This company hasn't been onboarded as a service customer yet, so a follow-up can't be logged for it.");
            }
            return apiRequestJson("POST", "/api/service/followups", {
                serviceCustomerId: followServiceCustomerId,
                customerId: followCompanySel.id,
                method: followMethod,
                purpose: followPurpose || undefined,
                note: followNote || undefined,
                nextFollowupDate: followNextDate ? new Date(followNextDate).toISOString() : undefined,
            });
        },
        onSuccess: () => {
            toast({ title: "Follow-up logged" });
            setFollowCompanySel({ id: '', label: '' });
            setFollowPurpose('');
            setFollowMethod('');
            setFollowNextDate('');
            setFollowNote('');
        },
        onError: (err: any) => {
            toast({ title: "Could not log follow-up", description: err?.message, variant: "destructive" });
        },
    });

    const handleFollowSubmit = () => {
        if (!followCompanySel.id || !followMethod || !followServiceCustomerId) return;
        createFollowupMutation.mutate();
    };

    const [apptCompanySel, setApptCompanySel] = useState<{ id: string; label: string }>({ id: '', label: '' });
    const [apptSubject, setApptSubject] = useState('');

    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: todayApptRes } = useQuery<{ data: any[] }>({
        queryKey: ["/api/sales/appointments", todayIso],
        queryFn: () => apiRequestJson<{ data: any[] }>("GET", `/api/sales/appointments?date=${todayIso}`),
    });
    const todayAppointments = todayApptRes?.data || [];
    const inProcessAppointments = todayAppointments.filter((a) => !a.endsAt);
    const endedAppointments = todayAppointments.filter((a) => !!a.endsAt);

    const createAppointmentMutation = useMutation({
        mutationFn: () => {
            const now = new Date();
            return apiRequestJson("POST", "/api/sales/appointments", {
                customerId: apptCompanySel.id,
                purpose: apptSubject,
                date: todayIso,
                time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sales/appointments"] });
            setApptCompanySel({ id: '', label: '' });
            setApptSubject('');
            toast({ title: "Appointment created" });
        },
        onError: (err: any) => {
            toast({ title: "Failed to create appointment", description: err?.message, variant: "destructive" });
        },
    });

    const endAppointmentMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("PATCH", `/api/sales/appointments/${id}/end`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sales/appointments"] });
        },
        onError: (err: any) => {
            toast({ title: "Failed to end appointment", description: err?.message, variant: "destructive" });
        },
    });

    const handleCreateAppointment = () => {
        if (apptCompanySel.id && apptSubject) {
            createAppointmentMutation.mutate();
        }
    };

    const topSelling = [
        { title: "Total Revenue", value: `${stats.totalRevenue || 0}$`, icon: Users },
        { title: "New", value: String(stats.new || 0), icon: ArrowRightLeft },
        { title: "Renew", value: String(stats.renew || 0), icon: Tag },
        { title: "Expire", value: String(stats.expire || 0), icon: Target },
        { title: "In Service", value: String(stats.inService || 0), icon: Users },
        { title: "Kwa", value: String(stats.kwa || 0), icon: ArrowRightLeft },
        { title: "Psa", value: String(stats.psa || 0), icon: Tag },
        { title: "Sponsor Brand", value: String(stats.sponsorBrand || 0), icon: Target },
    ];

    const targetData = [
        { name: 'A', count: counts.grades?.A || 0 },
        { name: 'B+', count: counts.grades?.B_PLUS || 0 },
        { name: 'B', count: counts.grades?.B || 0 },
        { name: 'B-', count: counts.grades?.B_MINUS || 0 },
        { name: 'CMP', count: (counts.complaints?.open || 0) + (counts.complaints?.in_progress || 0) },
        { name: 'DRP', count: counts.dropouts || 0 },
        { name: 'FUP', count: counts.dueFollowups || 0 },
        { name: 'PAY', count: counts.duePayments || 0 },
    ];

    const quickEntries = [
        "Duplication Check", "Private Pool", "Service Pool", "BV Checking", "Over Time", "Public Pool", "New In Service"
    ];

    const grades = counts.grades || {};
    const complaints = counts.complaints || {};
    const openComplaints =
        (complaints.open || 0) + (complaints.in_progress || 0);

    const importantStats = [
        { label: "In Service", value: String(grades.A != null || grades.B_PLUS != null || grades.B != null || grades.B_MINUS != null ? (grades.A || 0) + (grades.B_PLUS || 0) + (grades.B || 0) + (grades.B_MINUS || 0) : 0) },
        { label: "A- Followup", value: String(grades.A || 0) },
        { label: "B+ Followup", value: String(grades.B_PLUS || 0) },
        { label: "B Followup", value: String(grades.B || 0) },
        { label: "B- Followup", value: String(grades.B_MINUS || 0) },
        { label: "30-Days Followup", value: String(counts.dueFollowups || 0) },
        { label: "7-Day Dropout", value: String(counts.dropouts || 0) },
        { label: "Dropout Leads", value: String(counts.dropouts || 0) },
        { label: "Complaints", value: String(openComplaints) },
        { label: "Not Follow Yet", value: String(counts.dueFollowups || 0) },
        { label: "BV Document", value: String(counts.documents?.bv || 0) },
        { label: "VAS Document", value: String(counts.documents?.vas || 0) },
        { label: "Due Payment", value: String(counts.duePayments || 0) },
        { label: "To Do List", value: "►", isIcon: true },
    ];

    const importantRoutes: Record<string, string> = {
        'A- Followup': '/service/a-customer',
        'B+ Followup': '/service/b-plus-customer',
        'B Followup': '/service/b-customer',
        'B- Followup': '/service/b-minus-customer',
        '30-Days Followup': '/service/monthly-followup',
        '7-Day Dropout': '/service/weekly-dropout',
        'Dropout Leads': '/service/dropout-customer',
        'Complaints': '/service/complaint-list',
        'Not Follow Yet': '/service/not-follow-customer',
        'BV Document': '/service/bv-document-list',
        'VAS Document': '/service/vas-document-list',
        'Due Payment': '/service/due-vas-payment',
        'To Do List': '/service/todo-list'
    };

    return (
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
            <div className="mb-6 px-2">
                <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 uppercase tracking-tight">
                    DASHBOARD <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">/ SERVICE DEPARTMENT</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
                {/* Left Area: Top Selling + Activities + Target (Span 8) */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Top Selling */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Top Selling</h3>
                            <Select value={topSellingPeriod} onValueChange={setTopSellingPeriod}>
                                <SelectTrigger className="w-28 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WC">WC</SelectItem>
                                    <SelectItem value="MONTH">MC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {topSelling.map((stat, i) => (
                                <div key={i} className="bg-white border border-slate-100 p-4 rounded-md flex justify-between items-center shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                    <div>
                                        <p className="text-[12px] text-slate-500 font-semibold mb-1 dark:text-zinc-400">{stat.title}</p>
                                        <p className="text-[18px] font-bold text-slate-700 dark:text-zinc-400">{stat.value}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-[#059669] flex items-center justify-center text-white shrink-0 shadow-md">
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Activities */}
                        <div className="lg:col-span-4 bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Activities</h3>
                                <Select value={activitiesPeriod} onValueChange={setActivitiesPeriod}>
                                    <SelectTrigger className="w-20 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TD">TD</SelectItem>
                                        <SelectItem value="WC">WC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-[12px] font-semibold text-slate-600 mb-2 flex justify-between px-2 dark:text-zinc-300">
                                <span>Method</span>
                                <span>Target</span>
                                <span>Calls</span>
                            </div>
                            {Object.keys(activities.methodTargets).length > 0 ? (
                                <div className="space-y-1.5 px-2">
                                    {Object.entries(activities.methodTargets).map(([method, v]) => (
                                        <div key={method} className="flex justify-between text-[12px] text-slate-600 dark:text-zinc-300">
                                            <span>{method}</span>
                                            <span>{v.achieved}/{v.target}</span>
                                            <span>{activities.methodCounts[method] ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center mt-4 text-[12px] text-slate-400 font-medium px-2">No activity logged for this period</div>
                            )}
                            <div className="text-center mt-4 text-[12px] text-slate-500 font-medium px-2 dark:text-zinc-400">
                                Talk Time W-H 8(480 M) Spent({activities.totalMinutes} M)
                            </div>
                        </div>

                        {/* Target Chart */}
                        <div className="lg:col-span-8 bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Target</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setTargetView('overall')} className={`px-4 py-1.5 rounded text-[12px] font-bold transition-colors ${targetView === 'overall' ? 'bg-[#059669] text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100'}`}>OverAll</button>
                                    <button onClick={() => setTargetView('t-ab')} className={`px-4 py-1.5 rounded text-[12px] font-bold transition-colors ${targetView === 't-ab' ? 'bg-[#059669] text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100'}`}>T-AB</button>
                                    <button onClick={() => setTargetView('t-vas')} className={`px-4 py-1.5 rounded text-[12px] font-bold transition-colors ${targetView === 't-vas' ? 'bg-[#059669] text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100'}`}>T-VAS</button>
                                </div>
                            </div>
                            
                            {targetView === 'overall' && (
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={targetData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 11 }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {targetView === 't-ab' && (
                                <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-slate-100 dark:border-zinc-800">
                                                <TableHead className="w-[60px] text-[12px] font-bold text-slate-600 dark:text-zinc-300">#</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Target</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Bonus</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Price/Target</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Reward</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Kwa</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Vas</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {targetView === 't-vas' && (
                                <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-slate-100 dark:border-zinc-800">
                                                <TableHead className="w-[60px] text-[12px] font-bold text-slate-600 dark:text-zinc-300">#</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Target</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Bonus</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Price/Target</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Reward</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Kwa</TableHead>
                                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Vas</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">1</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(200000-249000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">200000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">10000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">2</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(150000-199000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">150000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">7500</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">3</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(100000-149000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">100000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">5000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">4</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(50000-99000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">50000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">2500</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">5</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(1000-49000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">10%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">1000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Area: Banner + Target Achieve + Quick Entries + Today Appointment (Span 4) */}
                <div className="xl:col-span-4 space-y-6">
                    {/* Banner Image */}
                    <div className="h-32 w-full rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative">
                        <img src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Banner" className="w-full h-full object-cover" />
                        <ChevronLeft className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 h-8 w-8 cursor-pointer hover:text-white" />
                        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 h-8 w-8 cursor-pointer hover:text-white" />
                    </div>

                    {/* Target Achive */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <div className="flex justify-between">
                            <div>
                                <h3 className="text-[15px] font-bold text-[#475569] mb-1 dark:text-zinc-400">Target Achive</h3>
                                <p className="text-[12px] text-slate-400 mb-2">This month vas</p>
                                <p className="text-[18px] font-bold text-slate-700 mb-1 dark:text-zinc-400">RS {vasTarget.achieved} / <span className="text-[15px] text-slate-500 dark:text-zinc-400">{vasTarget.target}</span></p>
                                <p className="text-[12px] text-emerald-500 font-semibold mb-6">{vasTarget.percent}% <span className="text-slate-400 font-normal">of this month's team target</span></p>
                                <Button 
                                    className="bg-[#059669] hover:bg-emerald-700 text-white h-8 px-4 text-[12px] rounded font-bold shadow-md"
                                    onClick={() => setLocation('/dashboard/vas-system')}
                                >
                                    View More →
                                </Button>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                                <div className="relative w-24 h-24">
                                    <svg className="w-full h-full" viewBox="0 0 36 36">
                                        <path
                                            className="text-slate-100"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                        />
                                        <path
                                            className="text-emerald-500"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                            strokeDasharray={`${Math.min(100, vasTarget.percent)} 100`}
                                        />
                                    </svg>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                        <span className="text-[16px] font-bold text-slate-400">{vasTarget.percent}%</span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-slate-400 mt-1 font-medium">Monthly</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Entries */}
                    <ServiceQuickEntriesCard />

                    {/* Today Appointment */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Today Appointment</h3>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Plus className="h-4 w-4 text-[#059669] cursor-pointer hover:scale-110 transition-transform dark:text-zinc-400" />
                                </DialogTrigger>
                                <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto p-8 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                    <DialogHeader className="mb-4">
                                        <DialogTitle className="text-xl font-semibold text-slate-600 dark:text-zinc-300">Follow The Customer</DialogTitle>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4">
                                        {/* Search Company */}
                                        <CompanySearchSelect value={followCompanySel} onChange={setFollowCompanySel} />

                                        {followCompanySel.id && !followLookupLoading && !followServiceCustomerId && (
                                            <div className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                                                <span>This company hasn't been onboarded to the service module yet.</span>
                                                <div className="flex items-center gap-2">
                                                    <Select value={onboardAssignee} onValueChange={setOnboardAssignee}>
                                                        <SelectTrigger className="h-8 flex-1 bg-white text-[12px] border-amber-200 text-slate-600 dark:bg-zinc-900 dark:border-amber-900 dark:text-zinc-300">
                                                            <SelectValue placeholder="Assign to myself" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {teamExecutives.map((u) => (
                                                                <SelectItem key={u.id} value={u.id}>{u.name} ({u.roleId})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 text-[11px] bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                                                        onClick={() => onboardMutation.mutate()}
                                                        disabled={onboardMutation.isPending}
                                                    >
                                                        {onboardMutation.isPending ? "Onboarding..." : "Onboard Now"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Purpose */}
                                        <div className="flex items-center gap-4 text-[13px]">
                                            <span className="text-[#059669] font-medium w-24 dark:text-zinc-400">Purpose * :</span>
                                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                                {['New Sell', 'Inform', 'Payment Recovery', 'Ab Payment', 'Project Data', 'Renew Sell', 'Seminar', 'Webinar', 'Training'].map(p => (
                                                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="purpose"
                                                            className="accent-[#059669]"
                                                            checked={followPurpose === p}
                                                            onChange={() => setFollowPurpose(p)}
                                                        />
                                                        {p}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Method */}
                                        <div className="flex items-center gap-4 text-[13px] pt-2">
                                            <span className="text-[#059669] font-medium w-24 dark:text-zinc-400">Method * :</span>
                                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                                {['Mobile', 'On-Site Appointment', 'E-mail', 'Vm Appointment', 'Fax', 'No Need'].map(r => (
                                                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="method"
                                                            className="accent-[#059669]"
                                                            checked={followMethod === r}
                                                            onChange={() => setFollowMethod(r)}
                                                        />
                                                        {r}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Next Date & Note */}
                                        <div className="flex gap-6 pt-2">
                                            <div className="w-[30%] flex items-start gap-4 text-[13px]">
                                                <span className="text-[#059669] font-medium shrink-0 pt-2 dark:text-zinc-400">Next Date * :</span>
                                                <input 
                                                    type="datetime-local" 
                                                    className="w-full border border-slate-200 rounded h-10 px-3 text-slate-500 dark:text-zinc-400 dark:border-zinc-800" 
                                                    value={followNextDate}
                                                    onChange={(e) => setFollowNextDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="w-[70%] flex items-start gap-4 text-[13px]">
                                                <span className="text-[#059669] font-medium shrink-0 pt-2 dark:text-zinc-400">Note * :</span>
                                                <textarea 
                                                    className="w-full border border-slate-200 rounded min-h-[40px] p-2 resize-y dark:border-zinc-800" 
                                                    value={followNote}
                                                    onChange={(e) => setFollowNote(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Submit Button */}
                                        <div className="pt-4">
                                            <Button
                                                className="w-full bg-[#059669] hover:bg-emerald-700 text-white h-10 rounded text-[14px]"
                                                onClick={handleFollowSubmit}
                                                disabled={!followCompanySel.id || !followMethod || !followServiceCustomerId || createFollowupMutation.isPending}
                                            >
                                                {createFollowupMutation.isPending ? "Submitting..." : "Submit"}
                                            </Button>
                                        </div>

                                        <hr className="my-6 border-slate-100 dark:border-zinc-800" />

                                        {/* Create Appointment Section */}
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-600 mb-4 dark:text-zinc-300">Create Appointment</h3>
                                            
                                            <div className="flex gap-4 items-end mb-8">
                                                <div className="flex-1">
                                                    <label className="block text-[12px] text-slate-600 mb-1 dark:text-zinc-300">Name</label>
                                                    <CompanySearchSelect value={apptCompanySel} onChange={setApptCompanySel} />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[12px] text-slate-600 mb-1 dark:text-zinc-300">Subject</label>
                                                    <textarea
                                                        className="w-full border border-slate-200 rounded h-10 p-2 resize-none dark:border-zinc-800"
                                                        value={apptSubject}
                                                        onChange={(e) => setApptSubject(e.target.value)}
                                                    />
                                                </div>
                                                <Button
                                                    className="bg-[#059669] hover:bg-emerald-700 text-white h-10 px-6 rounded"
                                                    onClick={handleCreateAppointment}
                                                    disabled={!apptCompanySel.id || !apptSubject || createAppointmentMutation.isPending}
                                                >
                                                    {createAppointmentMutation.isPending ? "Creating..." : "Create"}
                                                </Button>
                                            </div>

                                            {/* Tables Row */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="text-lg font-semibold text-slate-600 mb-3 dark:text-zinc-300">In Process</h4>
                                                    <div className="border border-slate-100 rounded dark:border-zinc-800">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Company</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Meeting By</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Purpose</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Time</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Action</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {inProcessAppointments.length > 0 ? (
                                                                    inProcessAppointments.map((appt) => (
                                                                        <TableRow key={appt.id} className="border-b border-slate-100 dark:border-zinc-800">
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.company}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.meetingBy}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.purpose}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.startsAt ? new Date(appt.startsAt).toLocaleTimeString() : ""}</TableCell>
                                                                            <TableCell className="text-[12px] py-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-7 text-[11px]"
                                                                                    onClick={() => endAppointmentMutation.mutate(appt.id)}
                                                                                    disabled={endAppointmentMutation.isPending}
                                                                                >
                                                                                    End
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))
                                                                ) : (
                                                                    <TableRow className="border-b-0">
                                                                        <TableCell colSpan={5} className="h-10 text-center text-[12px] text-slate-400">No appointments in process</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-semibold text-slate-600 mb-3 dark:text-zinc-300">End Meeting</h4>
                                                    <div className="border border-slate-100 rounded dark:border-zinc-800">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Company</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Meeting By</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Start</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">End</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {endedAppointments.length > 0 ? (
                                                                    endedAppointments.map((appt) => {
                                                                        const mins = appt.startsAt && appt.endsAt
                                                                            ? Math.round((new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 60000)
                                                                            : null;
                                                                        return (
                                                                            <TableRow key={appt.id} className="border-b border-slate-100 dark:border-zinc-800">
                                                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.company}</TableCell>
                                                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.meetingBy}</TableCell>
                                                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.startsAt ? new Date(appt.startsAt).toLocaleTimeString() : ""}</TableCell>
                                                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.endsAt ? new Date(appt.endsAt).toLocaleTimeString() : ""}</TableCell>
                                                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{mins != null ? `${mins}M` : "—"}</TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <TableRow className="border-b-0">
                                                                        <TableCell colSpan={5} className="h-10 text-center text-[12px] text-slate-400">No ended meetings yet today</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 px-1 dark:text-zinc-400">
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full border border-slate-400 flex items-center justify-center text-[8px] dark:border-zinc-800">C</span>
                                Company
                            </div>
                            <span>Perpous</span>
                            <span>Time</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Row: Chart Data & Important Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
                {/* Chart Data Table (Span 8) */}
                <div className="xl:col-span-8 bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Chart Data</h3>
                        <Select value={chartStage} onValueChange={(v) => { setChartStage(v); setChartPage(1); }}>
                            <SelectTrigger className="w-[180px] h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ld">LD (Lead)</SelectItem>
                                <SelectItem value="qf">QF (Qualify)</SelectItem>
                                <SelectItem value="ay">AY (Analysis)</SelectItem>
                                <SelectItem value="in">IN (Invoice)</SelectItem>
                                <SelectItem value="pm">PM (Payment)</SelectItem>
                                <SelectItem value="gm">GM (Gold Member)</SelectItem>
                                <SelectItem value="bv">BV (Bussines Verification)</SelectItem>
                                <SelectItem value="nc">NC (New Customer)</SelectItem>
                                <SelectItem value="rc">RC (Renewal Customer)</SelectItem>
                                <SelectItem value="ec">EC (Expire Customer)</SelectItem>
                                <SelectItem value="fw">FW (Follow)</SelectItem>
                                <SelectItem value="nf">NF (Not Follow)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-zinc-400">
                            Show
                            <Select value={chartPageSize} onValueChange={(v) => { setChartPageSize(v); setChartPage(1); }}>
                                <SelectTrigger className="w-[60px] h-8 border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                            entries
                        </div>
                        <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-zinc-400">
                            Search:
                            <Input
                                type="text"
                                className="h-8 w-[150px] border-slate-200 dark:border-zinc-800"
                                value={chartSearch}
                                onChange={(e) => { setChartSearch(e.target.value); setChartPage(1); }}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-100 mb-4 dark:border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-zinc-800">
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">DRM ID</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Company</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Account</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Email</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Phone</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Grade</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Create</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pipelineNotTracked ? (
                                    <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                        <TableCell colSpan={7} className="text-center py-4 text-[13px] text-slate-500 dark:text-zinc-400">This stage isn't tracked as customer data in the service module yet</TableCell>
                                    </TableRow>
                                ) : pagedPipelineRows.length > 0 ? (
                                    pagedPipelineRows.map((r) => (
                                        <TableRow key={r.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                            <TableCell className="text-[12px] font-semibold text-emerald-600 py-2 dark:text-emerald-400">{r.drmId || r.id.slice(0, 8)}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{r.company || "—"}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{r.account || "—"}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{r.email || "—"}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{r.phone || "—"}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{r.grade || "—"}</TableCell>
                                            <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                        <TableCell colSpan={7} className="text-center py-4 text-[13px] text-slate-500 dark:text-zinc-400">No data available in table</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-between items-center text-[13px] text-slate-500 dark:text-zinc-400">
                        <span>
                            {filteredPipelineRows.length > 0
                                ? `Showing ${(chartPage - 1) * chartPageSizeNum + 1} to ${Math.min(chartPage * chartPageSizeNum, filteredPipelineRows.length)} of ${filteredPipelineRows.length} entries`
                                : "Showing 0 to 0 of 0 entries"}
                        </span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-8 text-[12px] px-3" disabled={chartPage <= 1} onClick={() => setChartPage((p) => Math.max(1, p - 1))}>Previous</Button>
                            <Button variant="outline" size="sm" className="h-8 text-[12px] px-3" disabled={chartPage >= chartTotalPages} onClick={() => setChartPage((p) => Math.min(chartTotalPages, p + 1))}>Next</Button>
                        </div>
                    </div>
                </div>

                {/* Important Stats (Span 4) */}
                <div className="xl:col-span-4 bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                    <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Important</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {importantStats.map((stat, idx) => (
                            <div 
                                key={idx} 
                                className="flex items-center justify-between px-3 py-2 bg-slate-100/50 border border-slate-100 rounded cursor-pointer hover:bg-slate-200 transition-colors dark:border-zinc-800"
                                onClick={() => {
                                    if (stat.label === 'In Service') {
                                        setInServiceModalOpen(true);
                                    } else if (importantRoutes[stat.label]) {
                                        setLocation(importantRoutes[stat.label]);
                                    }
                                }}
                            >
                                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">{stat.label}</span>
                                {stat.isIcon ? (
                                    <Play className="h-3 w-3 text-slate-400" />
                                ) : (
                                    <span className="text-[11px] font-bold text-slate-500 italic dark:text-zinc-400">{stat.value}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <InServiceModal isOpen={inServiceModalOpen} onClose={() => setInServiceModalOpen(false)} />
                </div>
            </div>

            {/* Bottom Row: Customer Monthly */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 mb-6 dark:bg-zinc-900">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Customer Monthly</h3>
                    <Select value={customerMonthlyFilter} onValueChange={(val: 'gm' | 'bv') => setCustomerMonthlyFilter(val)}>
                        <SelectTrigger className="w-[120px] h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="gm">GM</SelectItem>
                            <SelectItem value="bv">BV</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="flex justify-between mb-4">
                    <Button className="bg-[#6b7280] hover:bg-slate-600 text-white h-8 px-4 text-[12px] rounded">Focus</Button>
                    <div className="flex gap-0 relative">
                        <Button 
                            onClick={handleDisplayAll}
                            className={`${displayAllActive ? 'bg-[#059669] hover:bg-emerald-700' : 'bg-[#6b7280] hover:bg-slate-600'} text-white h-8 px-4 text-[12px] rounded rounded-r-none`}
                        >
                            Display all
                        </Button>
                        <Button 
                            onClick={() => {
                                setDisplayMenuOpen(!displayMenuOpen);
                            }}
                            className={`${!displayAllActive && displayMenuOpen ? 'bg-[#475569]' : 'bg-[#6b7280] hover:bg-slate-600'} text-white h-8 px-4 text-[12px] rounded rounded-l-none border-l border-slate-500/30`}
                        >
                            Display
                        </Button>

                        {displayMenuOpen && (
                            <div className="absolute right-0 top-9 w-40 bg-white border border-slate-200 shadow-lg rounded py-2 z-10 flex flex-col gap-2 dark:bg-zinc-900 dark:border-zinc-800">
                                {['Account', 'Email', 'Phone', 'NTN', 'Grade'].map((item) => (
                                    <div 
                                        key={item} 
                                        className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800"
                                        onClick={() => toggleColumn(item)}
                                    >
                                        <div className={`${visibleColumns[item] ? 'bg-[#059669]' : 'bg-white dark:bg-zinc-900 border border-slate-300'} text-white rounded-[2px] w-4 h-4 flex items-center justify-center`}>
                                            {visibleColumns[item] && (
                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-[12px] text-slate-600 dark:text-zinc-300">{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto rounded border-t border-slate-200 mt-2 dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-slate-200 dark:border-zinc-800">
                                <TableHead className="w-10">
                                    <input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" />
                                </TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">DRM ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Company</TableHead>
                                {visibleColumns.Account && <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Account</TableHead>}
                                {visibleColumns.Email && <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Email</TableHead>}
                                {visibleColumns.Phone && <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Phone</TableHead>}
                                {visibleColumns.NTN && <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">NTN</TableHead>}
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">CNIC</TableHead>
                                {visibleColumns.Grade && <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Grade</TableHead>}
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Follow</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">{customerMonthlyFilter === 'gm' ? 'GM' : 'BV'}</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Create</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyCustomers.length > 0 ? (
                                monthlyCustomers.map((c) => (
                                    <TableRow key={c.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                        <TableCell className="w-10">
                                            <input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" />
                                        </TableCell>
                                        <TableCell className="text-[12px] font-semibold text-emerald-600 py-2 dark:text-emerald-400">{c.drmId || c.id.slice(0, 8)}</TableCell>
                                        <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.company || "—"}</TableCell>
                                        {visibleColumns.Account && <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.accountName || "—"}</TableCell>}
                                        {visibleColumns.Email && <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.email || "—"}</TableCell>}
                                        {visibleColumns.Phone && <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.phone || "—"}</TableCell>}
                                        {visibleColumns.NTN && <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.ntn || "—"}</TableCell>}
                                        <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.cnic || "—"}</TableCell>
                                        {visibleColumns.Grade && <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.grade || "—"}</TableCell>}
                                        <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{c.followCount}</TableCell>
                                        <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">✓</TableCell>
                                        <TableCell className="text-[12px] text-slate-500 py-2 dark:text-zinc-400">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                    <TableCell colSpan={6 + Object.values(visibleColumns).filter(Boolean).length} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">No data available in table</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
