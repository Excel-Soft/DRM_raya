import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/breadcrumb";
import { SalesKpiCard } from "@/components/sales-kpi-card";
import { ActivitiesGrid } from "@/components/activities-grid";
import { PipelineSummary } from "@/components/pipeline-summary";
import { TargetAchieve } from "@/components/target-achieve";
import { QuickEntriesCard } from "@/components/quick-entries-card";
import { ImportantMetrics } from "@/components/important-metrics";
import { ChartDataWidget } from "@/components/chart-data-widget";
import { ProductPostingSalesWidget } from "@/components/product-posting-sales-widget";
import { CustomerMonthlyWidget } from "@/components/customer-monthly";
import { PromotionalBanner } from "@/components/promotional-banner";
import { MyGmCommissionWidget } from "@/components/my-gm-commission-widget";
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
  ShieldCheck
} from "lucide-react";

type Period = "TD" | "WC" | "MC" | "QC" | "YC";

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
  { value: "TD", label: "Today" },
  { value: "WC", label: "Week Cumulative" },
  { value: "MC", label: "Month Cumulative" },
  { value: "QC", label: "Quarter Cumulative" },
  { value: "YC", label: "Year Cumulative" },
];

export default function SalesExecutiveDashboard() {
  const [period, setPeriod] = useState<Period>("TD");
  const [followStartDate, setFollowStartDate] = useState<string>("");
  const [followEndDate, setFollowEndDate] = useState<string>("");
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [activeFollowService, setActiveFollowService] = useState<string>("All");
  const [activeFollowSubtype, setActiveFollowSubtype] = useState<string>("All");
  const [activeFollowGrade, setActiveFollowGrade] = useState<string>("All");
  const [followData, setFollowData] = useState<any[]>([]);

  const { data: followupsRes } = useQuery({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
  const followupsData = (followupsRes as any)?.data?.items || [];

  const handleFollowFilter = () => {
    setAppliedStartDate(followStartDate);
    setAppliedEndDate(followEndDate);
  };

  // Calculate counts for each service category
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

  const uniqueSubtypes = Array.from(new Set(filteredByServiceAndDate.filter((r:any) => activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase()).map((r: any) => r.subserviceName || r.serviceType || "General"))).filter(Boolean) as string[];
  const uniqueGrades = Array.from(new Set(filteredByServiceAndDate.filter((r:any) => activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase()).map((r: any) => r.grade || "A"))).filter(Boolean) as string[];

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
      created: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"
  }));

  const [followPage, setFollowPage] = useState<number>(1);
  const followPageSize = 10;

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

  // Fetch sales overview data
  const { data: salesData, isLoading } = useQuery<SalesOverviewData>({
    queryKey: [`/api/sales/overview?period=${period}`],
    enabled: true,
    ...commonQueryOptions,
    placeholderData: emptySalesData,
  });

  const kpiCards = [
    { key: "totalContact", title: "Total Contact", icon: DollarSign, color: "text-emerald-600", iconBg: "bg-emerald-500" },
    { key: "new", title: "New", icon: UserPlus, color: "text-blue-600", iconBg: "bg-blue-500" },
    { key: "renew", title: "Renew", icon: RefreshCw, color: "text-indigo-600", iconBg: "bg-indigo-500" },
    { key: "expire", title: "Expire", icon: Clock, color: "text-amber-600", iconBg: "bg-amber-500" },
    { key: "vm", title: "VM", icon: Briefcase, color: "text-rose-600", iconBg: "bg-rose-500" },
    { key: "kwa", title: "Kwe/Kwa", icon: Zap, color: "text-purple-600", iconBg: "bg-purple-500" },
    { key: "psa", title: "PSA", icon: ShieldCheck, color: "text-cyan-600", iconBg: "bg-cyan-500" },
    { key: "sponsor", title: "Sponsor Brand", icon: Award, color: "text-pink-600", iconBg: "bg-pink-500" },
  ];

  return (
    <div className="flex-1 overflow-auto font-['Poppins'] bg-slate-50/50 dark:bg-zinc-950">
      <div className="wide-page p-4 md:p-6 lg:p-8 space-y-6">
        <Breadcrumb
          items={[
            { label: "DASHBOARD" },
            { label: "SALES DEPARTMENT" },
            { label: "SALES EXECUTIVE" },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Sales Executive Dashboard</h1>

          <div className="flex items-end gap-2">
            <Label htmlFor="period-select" className="text-sm text-muted-foreground">
              Choose Period:
            </Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="w-[200px]" id="period-select" data-testid="select-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} data-testid={`period-${option.value}`}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-4">
          {kpiCards.map(({ key, title, icon, color, iconBg }) => {
            const kpiData = (salesData ?? emptySalesData)[key as keyof SalesOverviewData];
            return (
              <SalesKpiCard
                key={key}
                title={title}
                count={kpiData?.count ?? 0}
                amount={kpiData?.amount ?? 0}
                icon={icon}
                color={color}
                iconBg={iconBg}
                isLoading={isLoading}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ActivitiesGrid />
            <PipelineSummary period={period} />
            <ChartDataWidget period={period} />
            <CustomerMonthlyWidget />
          </div>

          <div className="space-y-6">
            <PromotionalBanner />
            <ProductPostingSalesWidget />
            <TargetAchieve />
            <MyGmCommissionWidget />
            <QuickEntriesCard />
            <ImportantMetrics />
          </div>
        </div>

        {/* Row 4: Follow Up Details */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl mt-8 dark:bg-zinc-900/50 dark:border-zinc-800/50 overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-zinc-800/50">
            <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-zinc-100">Follow Up Details</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <input 
                type="date" 
                value={followStartDate}
                onChange={(e) => setFollowStartDate(e.target.value)}
                className="border border-slate-200 bg-white rounded-md px-3 h-9 text-sm w-[140px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300" 
              />
              <span className="text-slate-400 text-sm">-</span>
              <input 
                type="date" 
                value={followEndDate}
                onChange={(e) => setFollowEndDate(e.target.value)}
                className="border border-slate-200 bg-white rounded-md px-3 h-9 text-sm w-[140px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300" 
              />
              <button 
                onClick={handleFollowFilter} 
                className="bg-emerald-600 text-white text-sm px-4 h-9 rounded-md font-medium hover:bg-emerald-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
              >
                Filter
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <div 
                onClick={() => handleTabClick("All")} 
                className={`px-4 py-2 rounded-md cursor-pointer transition-all text-sm font-medium shadow-sm border ${
                  activeFollowService === "All" 
                    ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-700" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                All <span className="ml-1 opacity-70">({getCount("All")})</span>
              </div>
              {allTabServices.map((svc) => {
                const isActive = activeFollowService === svc;
                // Use a consistent modern pill style
                return (
                  <div 
                    key={svc} 
                    onClick={() => handleTabClick(svc)} 
                    className={`px-4 py-2 rounded-md cursor-pointer transition-all text-sm font-medium shadow-sm border ${
                      isActive 
                        ? "bg-blue-600 text-white border-blue-600" 
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {svc} <span className="ml-1 opacity-70">({getCount(svc)})</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-5">
              {/* Service Type Summary */}
              {uniqueSubtypes.length > 0 && (
                <div className="flex-1 bg-slate-50/50 rounded-xl border border-slate-100 p-5 dark:bg-zinc-900/30 dark:border-zinc-800/50">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-700 mb-3 dark:text-zinc-200">Service Type Summary</h3>
                    <div className="flex flex-wrap gap-2">
                        {["All", ...uniqueSubtypes].map(sub => {
                          const count = getSubtypeCount(sub);
                          if (count === 0 && sub !== "All") return null;
                          const isActive = activeFollowSubtype === sub;
                          return (
                            <span 
                                key={sub}
                                onClick={() => setActiveFollowSubtype(sub)}
                                className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors border ${
                                  isActive 
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50" 
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                }`}
                            >
                                {sub} ({count})
                            </span>
                          );
                        })}
                    </div>
                </div>
              )}

              {/* Grade Summary */}
              {uniqueGrades.length > 0 && (
                <div className="flex-1 bg-slate-50/50 rounded-xl border border-slate-100 p-5 dark:bg-zinc-900/30 dark:border-zinc-800/50">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-700 mb-3 dark:text-zinc-200">Grade Summary</h3>
                    <div className="flex flex-wrap gap-2">
                        {["All", ...uniqueGrades].map(grade => {
                          const count = getGradeCount(grade);
                          if (count === 0 && grade !== "All") return null;
                          const isActive = activeFollowGrade === grade;
                          return (
                            <span 
                                key={grade}
                                onClick={() => setActiveFollowGrade(grade)}
                                className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors border ${
                                  isActive 
                                    ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600" 
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                                }`}
                            >
                                {grade} ({count})
                            </span>
                          );
                        })}
                    </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium dark:text-zinc-300">
                Show 
                <select className="border border-slate-200 bg-white rounded-md px-2 py-1.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm transition-all dark:bg-zinc-900 dark:border-zinc-700" disabled>
                  <option value="10">10</option>
                </select> 
                entries
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium dark:text-zinc-300">
                Search:
                <input type="text" placeholder="Search entries..." className="border border-slate-200 bg-white rounded-md px-3 py-1.5 w-full sm:w-[250px] shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all dark:bg-zinc-900 dark:border-zinc-700" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm dark:border-zinc-800">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">#</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Company</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Main Service</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Sub Type</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Grade</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Purpose</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Method</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Comment</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Sale Person</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Followup Note</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Next Date</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-200 whitespace-nowrap">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredFollowups.length > 0 ? (
                    filteredFollowups
                      .slice((followPage - 1) * followPageSize, followPage * followPageSize)
                      .map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors bg-white dark:bg-transparent dark:hover:bg-zinc-800/50">
                        <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{row.id}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium dark:text-zinc-200">{row.company}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.service}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.subtype}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
                            {row.grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.purpose}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.method}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.comment}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.person}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.note}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.next}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{row.created}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-12 px-4 text-slate-500 text-center font-medium bg-white dark:bg-transparent dark:text-zinc-400">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="h-8 w-8 text-slate-300 mb-2 dark:text-zinc-600" />
                          No Data Found for {activeFollowService}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 font-medium dark:text-zinc-400">
              <div>
                Showing {filteredFollowups.length > 0 ? (followPage - 1) * followPageSize + 1 : 0} to {Math.min(followPage * followPageSize, filteredFollowups.length)} of {filteredFollowups.length} entries
              </div>
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => setFollowPage(p => Math.max(1, p - 1))}
                  disabled={followPage === 1}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-xs font-medium shadow-sm"
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
                        className={`w-8 h-8 rounded-md border text-xs font-medium transition-colors shadow-sm ${
                          followPage === p
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
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
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-xs font-medium shadow-sm"
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
