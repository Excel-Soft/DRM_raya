import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/breadcrumb";
import { SalesKpiCard } from "@/components/sales-kpi-card";
import { ChartDataWidget } from "@/components/chart-data-widget";
import { ActivitiesTargetWidget } from "@/components/activities-target-widget";
import { TargetAchieve } from "@/components/target-achieve";
import { ServiceQuickEntriesCard } from "@/components/service-quick-entries-card";
import { ImportantMetrics } from "@/components/important-metrics";
import ServiceVasSystem from "@/pages/service-vas-system";
import { CustomerMonthlyWidget } from "@/components/customer-monthly";
import { TodayAppointment } from "@/components/today-appointment";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Users,
    UserPlus,
    RefreshCw,
    Clock,
    Video,
    Building2,
    FileText,
    Award,
    DollarSign,
    Briefcase,
    Zap,
    ShieldCheck,
    Target,
    ChevronLeft
} from "lucide-react";

type Period = "choose" | "TD" | "WC" | "MC" | "QC" | "YC" | "OverAll";

interface SalesKpi {
    count: number;
    amount: number;
}

interface SalesOverviewData {
    totalContact: SalesKpi;
    new: SalesKpi;
    renew: SalesKpi;
    expire: SalesKpi;
    vm: SalesKpi;
    kwa: SalesKpi;
    psa: SalesKpi;
    sponsor: SalesKpi;
}

const periodOptions = [
    { value: "TD", label: "TD" },
    { value: "WC", label: "WC" },
    { value: "MC", label: "MC" },
    { value: "QC", label: "QC" },
    { value: "YC", label: "YC" },
    { value: "OverAll", label: "OverAll" },
];

export default function ServiceExecutiveDashboard() {
    const [period, setPeriod] = useState<Period>("choose");
    const [activeView, setActiveView] = useState("dashboard");

    const commonQueryOptions = {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchOnMount: false as const,
    };

    const emptySalesData: SalesOverviewData = {
        totalContact: { count: 0, amount: 0 },
        new: { count: 0, amount: 0 },
        renew: { count: 0, amount: 0 },
        expire: { count: 0, amount: 0 },
        vm: { count: 0, amount: 0 },
        kwa: { count: 0, amount: 0 },
        psa: { count: 0, amount: 0 },
        sponsor: { count: 0, amount: 0 },
    };

    // Fetch sales overview data -> we can keep this for now to match the UI shape of Service Executive.
    const { data: salesData, isLoading } = useQuery<SalesOverviewData>({
        queryKey: [`/api/service/executive/stats?period=${period === "choose" ? "TD" : period}`],
        enabled: true,
        ...commonQueryOptions,
        placeholderData: emptySalesData,
    });

    const kpiCards = [
        { key: "totalContact", title: "Total Contact", icon: Users, color: "text-blue-600", iconBg: "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/30" },
        { key: "new", title: "New", icon: RefreshCw, color: "text-emerald-600", iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30" },
        { key: "renew", title: "Renew", icon: ShieldCheck, color: "text-violet-600", iconBg: "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30" },
        { key: "expire", title: "Expire", icon: Target, color: "text-rose-600", iconBg: "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30" },
        { key: "vm", title: "Vm", icon: Users, color: "text-amber-600", iconBg: "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30" },
        { key: "kwa", title: "Kwa", icon: RefreshCw, color: "text-cyan-600", iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-cyan-500/30" },
        { key: "psa", title: "Psa", icon: ShieldCheck, color: "text-fuchsia-600", iconBg: "bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 shadow-fuchsia-500/30" },
        { key: "sponsor", title: "Sponsor Brand", icon: Target, color: "text-indigo-600", iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/30" },
    ];

    if (activeView === "vas-system") {
        return (
            <div className="bg-[#f8fafc] font-sans min-h-screen flex flex-col dark:bg-zinc-950">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:text-[#059669] flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4 flex-1">
                    <ServiceVasSystem />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20">
            <div className="wide-page p-2 sm:p-4 lg:px-6 space-y-5">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 uppercase tracking-tight">
                        DASHBOARD <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">/ SERVICE DEPARTMENT</span>
                    </h2>
                    <div className="h-1 w-20 bg-gradient-to-r from-emerald-500 to-transparent rounded-full"></div>
                </div>

                <div className="flex items-end justify-between gap-4 mt-2">
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight dark:text-zinc-100">Top Selling Overview</h3>
                    <div className="flex items-end gap-2">
                        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                            <SelectTrigger className="w-[120px] h-9 text-xs font-semibold bg-white border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus:ring-1 focus:ring-emerald-500 rounded-lg transition-all dark:bg-zinc-900" id="period-select" data-testid="select-period">
                                <SelectValue placeholder="Choose" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-xl border-slate-100 dark:border-zinc-800">
                                <SelectItem value="choose" disabled className="text-xs font-medium">Choose Filter</SelectItem>
                                {periodOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value} data-testid={`period-${option.value}`} className="text-xs font-medium">
                                        🗓 {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
                    {kpiCards.map(({ key, title, icon, color, iconBg }) => {
                        const kpiData = (salesData ?? emptySalesData)[key as keyof SalesOverviewData];
                        return (
                            <SalesKpiCard
                                key={key}
                                title={title}
                                count={isLoading ? 0 : (kpiData?.count ?? 0)}
                                amount={isLoading ? 0 : (kpiData?.amount ?? 0)}
                                icon={icon}
                                color={color}
                                iconBg={iconBg}
                            />
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        <ActivitiesTargetWidget />
                        <ChartDataWidget period={period !== "choose" ? period : "TD"} />
                        <CustomerMonthlyWidget />
                    </div>
                    <div className="lg:col-span-1 space-y-4">
                        <TodayAppointment apiEndpoint="/api/service/executive/appointments" />
                        <TargetAchieve onViewMore={() => setActiveView("vas-system")} />
                        <ServiceQuickEntriesCard />
                        <ImportantMetrics />
                    </div>
                </div>
            </div>
        </div>
    );
}
