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
import { ServiceAppointmentModal } from "@/components/service-appointment-modal";
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

    // Follow Up Details — same real pattern as the Sales Executive dashboard
    // (sales-executive-dashboard.tsx), backed by the same role-aware
    // /api/dashboard/followups endpoint (scoped to this executive's own
    // assigned/owned/created customers).
    const [followStartDate, setFollowStartDate] = useState<string>("");
    const [followEndDate, setFollowEndDate] = useState<string>("");
    const [appliedStartDate, setAppliedStartDate] = useState<string>("");
    const [appliedEndDate, setAppliedEndDate] = useState<string>("");
    const [activeFollowService, setActiveFollowService] = useState<string>("All");
    const [activeFollowSubtype, setActiveFollowSubtype] = useState<string>("All");
    const [activeFollowGrade, setActiveFollowGrade] = useState<string>("All");
    const [followPage, setFollowPage] = useState<number>(1);
    const followPageSize = 10;

    const { data: followupsRes } = useQuery({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
    const followupsData = (followupsRes as any)?.data?.items || [];

    const handleFollowFilter = () => {
        setAppliedStartDate(followStartDate);
        setAppliedEndDate(followEndDate);
    };

    const getCount = (serviceName: string) => {
        if (serviceName === "All") return followupsData.length;
        return followupsData.filter((r: any) => {
            const sType = r.serviceType || "";
            return sType.toLowerCase() === serviceName.toLowerCase();
        }).length;
    };

    const filteredByServiceAndDate = followupsData.filter((row: any) => {
        let match = true;
        if (activeFollowService && activeFollowService !== "All") {
            const sType = row.serviceType || "Alibaba Membership";
            if (sType.toLowerCase() !== activeFollowService.toLowerCase()) {
                match = false;
            }
        }
        if (appliedStartDate && appliedEndDate) {
            const rowDate = row.createdAt ? new Date(row.createdAt) : new Date();
            const start = new Date(appliedStartDate);
            const end = new Date(appliedEndDate);
            end.setHours(23, 59, 59, 999);
            if (rowDate < start || rowDate > end) {
                match = false;
            }
        }
        return match;
    });

    const getSubtypeCount = (subtype: string) => {
        if (subtype === "All") return filteredByServiceAndDate.filter((r: any) => activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase()).length;
        return filteredByServiceAndDate.filter((r: any) => {
            const sType = r.subserviceName || r.serviceType || "General";
            const matchSub = sType.toLowerCase() === subtype.toLowerCase();
            const matchGrade = activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase();
            return matchSub && matchGrade;
        }).length;
    };

    const getGradeCount = (grade: string) => {
        if (grade === "All") return filteredByServiceAndDate.filter((r: any) => activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase()).length;
        return filteredByServiceAndDate.filter((r: any) => {
            const g = r.grade || "A";
            const matchGrade = g.toLowerCase() === grade.toLowerCase();
            const matchSub = activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase();
            return matchGrade && matchSub;
        }).length;
    };

    const uniqueSubtypes = Array.from(new Set(filteredByServiceAndDate.filter((r: any) => activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase()).map((r: any) => r.subserviceName || r.serviceType || "General"))).filter(Boolean) as string[];
    const uniqueGrades = Array.from(new Set(filteredByServiceAndDate.filter((r: any) => activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase()).map((r: any) => r.grade || "A"))).filter(Boolean) as string[];

    const filteredFollowups = filteredByServiceAndDate.filter((row: any) => {
        let match = true;
        if (activeFollowSubtype && activeFollowSubtype !== "All") {
            const sType = row.subserviceName || row.serviceType || "General";
            if (sType.toLowerCase() !== activeFollowSubtype.toLowerCase()) {
                match = false;
            }
        }
        if (activeFollowGrade && activeFollowGrade !== "All") {
            const g = row.grade || "A";
            if (g.toLowerCase() !== activeFollowGrade.toLowerCase()) {
                match = false;
            }
        }
        return match;
    }).map((row: any, index: number) => ({
        id: index + 1,
        company: row.company || "Unknown",
        service: row.serviceType || "Alibaba Membership",
        subtype: row.subserviceName || row.serviceType || "General",
        grade: row.grade || "A",
        purpose: row.purpose || "Follow Up",
        method: row.method || "Call",
        comment: row.notes || "-",
        person: row.salesPerson || "System",
        note: row.notes || "None",
        next: row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "-",
        created: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-",
    }));

    const handleTabClick = (serviceName: string) => {
        setActiveFollowService(serviceName);
        setActiveFollowSubtype("All");
        setActiveFollowGrade("All");
        setFollowPage(1);
    };

    const uniqueServices = Array.from(new Set(followupsData.map((r: any) => r.serviceType || "Alibaba Membership"))).filter(Boolean) as string[];
    const standardServices = ["Alibaba Membership", "Alibaba Services", "Design Development", "Domain Hosting"];
    const allTabServices = Array.from(new Set([...standardServices, ...uniqueServices]));

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
        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950">
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
                        <TodayAppointment
                            apiEndpoint="/api/service/executive/appointments"
                            renderModal={({ open, onClose }) => <ServiceAppointmentModal open={open} onClose={onClose} />}
                        />
                        <TargetAchieve onViewMore={() => setActiveView("vas-system")} />
                        <ServiceQuickEntriesCard />
                        <ImportantMetrics inServiceApiEndpoint="/api/service/executive/customers/in-service" />
                    </div>
                </div>

                {/* Follow Up Details */}
                <div className="bg-white shadow-sm border border-slate-200 rounded-[8px] mt-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800">
                        <h2 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Follow Up Details</h2>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                value={followStartDate}
                                onChange={(e) => setFollowStartDate(e.target.value)}
                                className="border border-slate-300 bg-transparent rounded-[4px] px-2 h-8 text-[13px] w-[130px] focus:outline-none focus:border-[#00a65a] dark:border-zinc-800"
                            />
                            <span className="mx-0.5 text-slate-400">-</span>
                            <input
                                type="date"
                                value={followEndDate}
                                onChange={(e) => setFollowEndDate(e.target.value)}
                                className="border border-slate-300 bg-transparent rounded-[4px] px-2 h-8 text-[13px] w-[130px] focus:outline-none focus:border-[#00a65a] dark:border-zinc-800"
                            />
                            <button onClick={handleFollowFilter} className="bg-[#00a65a] text-white text-[13px] px-5 h-8 rounded-[4px] font-bold hover:bg-[#008d4c] transition-colors shadow-sm ml-1">Filter</button>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="flex flex-wrap gap-2 mb-5">
                            <div onClick={() => handleTabClick("All")} className={`px-4 py-2 rounded-[4px] cursor-pointer transition-colors text-white text-[13px] font-bold shadow-sm ${activeFollowService === "All" ? "bg-slate-700 dark:bg-slate-600" : "bg-slate-500 hover:bg-slate-600 dark:bg-slate-700"}`}>All {getCount("All")}</div>
                            {allTabServices.map((svc) => {
                                const isActive = activeFollowService === svc;
                                let colorClass = "bg-blue-500 hover:bg-blue-600";
                                let activeColorClass = "bg-blue-600";

                                if (svc === "Alibaba Membership") { colorClass = "bg-[#38c172]/80 hover:bg-[#38c172]"; activeColorClass = "bg-[#38c172]"; }
                                else if (svc === "Alibaba Services") { colorClass = "bg-[#e3342f]/80 hover:bg-[#e3342f]"; activeColorClass = "bg-[#e3342f]"; }
                                else if (svc === "Design Development") { colorClass = "bg-[#3490dc]/80 hover:bg-[#3490dc]"; activeColorClass = "bg-[#3490dc]"; }
                                else if (svc === "Domain Hosting") { colorClass = "bg-[#343a40]/80 hover:bg-[#343a40]"; activeColorClass = "bg-[#343a40]"; }
                                else if (svc === "Digital Marketing") { colorClass = "bg-purple-500/80 hover:bg-purple-500"; activeColorClass = "bg-purple-600"; }

                                return (
                                    <div key={svc} onClick={() => handleTabClick(svc)} className={`px-4 py-2 rounded-[4px] cursor-pointer transition-colors text-white text-[13px] font-bold shadow-sm ${isActive ? activeColorClass : colorClass}`}>
                                        {svc} {getCount(svc)}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 mb-5">
                            {uniqueSubtypes.length > 0 && (
                                <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Service Type Summary</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {["All", ...uniqueSubtypes].map(sub => {
                                            const count = getSubtypeCount(sub);
                                            if (count === 0 && sub !== "All") return null;
                                            const isActive = activeFollowSubtype === sub;
                                            return (
                                                <span
                                                    key={sub}
                                                    onClick={() => setActiveFollowSubtype(sub)}
                                                    className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#059669] text-white border border-[#059669]" : "bg-white border border-[#059669] text-[#059669] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"}`}
                                                >
                                                    {sub} ({count})
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {uniqueGrades.length > 0 && (
                                <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Grade Summary</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {["All", ...uniqueGrades].map(grade => {
                                            const count = getGradeCount(grade);
                                            if (count === 0 && grade !== "All") return null;
                                            const isActive = activeFollowGrade === grade;
                                            return (
                                                <span
                                                    key={grade}
                                                    onClick={() => setActiveFollowGrade(grade)}
                                                    className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#1e293b] text-white border border-[#1e293b]" : "bg-white border border-slate-300 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"}`}
                                                >
                                                    {grade} ({count})
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-[6px] dark:border-zinc-800">
                            <table className="w-full text-[13px] text-left">
                                <thead className="bg-[#fbfcfd] border-b border-slate-200 dark:border-zinc-800 dark:bg-zinc-900">
                                    <tr>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">#</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Company</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Main Service</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Sub Type</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Grade</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Purpose</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Method</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Comment</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Service Person</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Followup Note</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Next Date</th>
                                        <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-zinc-300">Created Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFollowups.length > 0 ? (
                                        filteredFollowups
                                            .slice((followPage - 1) * followPageSize, followPage * followPageSize)
                                            .map((row: any, i: number) => (
                                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.id}</td>
                                                    <td className="py-3 px-4 text-slate-700 font-bold border-r border-slate-100 dark:border-zinc-800 dark:text-zinc-400">{row.company}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.service}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.subtype}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.grade}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.purpose}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.method}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.comment}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.person}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.note}</td>
                                                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">{row.next}</td>
                                                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.created}</td>
                                                </tr>
                                            ))
                                    ) : (
                                        <tr>
                                            <td colSpan={12} className="py-8 px-4 text-slate-500 text-center font-medium bg-slate-50/50 dark:bg-zinc-900 dark:text-zinc-400">
                                                No Data Found for {activeFollowService}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex justify-between items-center text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                            <div>
                                Showing {filteredFollowups.length > 0 ? (followPage - 1) * followPageSize + 1 : 0} to {Math.min(followPage * followPageSize, filteredFollowups.length)} of {filteredFollowups.length} entries
                            </div>
                            <div className="flex gap-1 items-center">
                                <button
                                    onClick={() => setFollowPage(p => Math.max(1, p - 1))}
                                    disabled={followPage === 1}
                                    className="px-3 py-1.5 rounded-[4px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-[12px] font-medium"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: Math.ceil(filteredFollowups.length / followPageSize) }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === Math.ceil(filteredFollowups.length / followPageSize) || Math.abs(p - followPage) <= 1)
                                    .reduce((acc: (number | string)[], p, idx, arr) => {
                                        if (idx > 0 && (arr[idx - 1] as number) < p - 1) acc.push('...');
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, idx) =>
                                        p === '...' ? (
                                            <span key={`dots-${idx}`} className="px-2 text-slate-400">...</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setFollowPage(p as number)}
                                                className={`w-8 h-8 rounded-[4px] border text-[12px] font-medium transition-colors ${followPage === p
                                                        ? 'bg-[#00a65a] text-white border-[#00a65a]'
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        )
                                    )
                                }
                                <button
                                    onClick={() => setFollowPage(p => Math.min(Math.ceil(filteredFollowups.length / followPageSize), p + 1))}
                                    disabled={followPage >= Math.ceil(filteredFollowups.length / followPageSize)}
                                    className="px-3 py-1.5 rounded-[4px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-[12px] font-medium"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
