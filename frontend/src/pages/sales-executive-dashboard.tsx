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
    <div className="flex-1 overflow-auto">
      <div className="wide-page p-2 sm:p-3 lg:px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: "DASHBOARD" },
            { label: "SALES DEPARTMENT" },
            { label: "SALES EXECUTIVE" },
          ]}
        />

        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-bold">Sales Executive Dashboard</h1>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                // Generate a consistent color based on service name or use default colors for standard ones
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
              {/* Service Type Summary */}
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

              {/* Grade Summary */}
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

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                Show 
                <select className="border border-slate-300 bg-transparent rounded-[4px] px-2 py-1 outline-none focus:border-[#00a65a] dark:border-zinc-800" disabled>
                  <option value="10">10</option>
                </select> 
                entries
              </div>
              <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                Search:
                <input type="text" className="border border-slate-300 bg-transparent rounded-[4px] px-3 py-1.5 w-[200px] focus:outline-none focus:border-[#00a65a] dark:border-zinc-800" />
              </div>
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
                    <th className="py-3.5 px-4 font-bold text-slate-600 border-r border-slate-100 dark:text-zinc-300 dark:border-zinc-800">Sale Person</th>
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
                        className={`w-8 h-8 rounded-[4px] border text-[12px] font-medium transition-colors ${
                          followPage === p
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
