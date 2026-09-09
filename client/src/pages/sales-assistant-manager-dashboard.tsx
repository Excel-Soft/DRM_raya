import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, RefreshCw, Clock, ArrowRightLeft, Briefcase, Zap, ShieldCheck, Award, Tag, Calendar, Download, List, Search, ChevronRight, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Swal from "sweetalert2";

export default function SalesAssistantManagerDashboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<string>("TD");
  const [activeTargetTab, setActiveTargetTab] = useState<string>("OverAll");
  const [chartStage, setChartStage] = useState<string>("LD");

  const { data: pipelineSummaryRes } = useQuery({ 
    queryKey: ["/api/sales/pipeline-summary", { period }] 
  });
  const pipelineStages = (pipelineSummaryRes as any)?.stages || {};

  const { data: chartDetailsRes } = useQuery({
    queryKey: ["/api/sales/pipeline-stage-details", { stage: chartStage, period }]
  });
  const chartOpportunities = (chartDetailsRes as any)?.opportunities || (Array.isArray(chartDetailsRes) ? chartDetailsRes : []);

  const { data: vasProgressRes } = useQuery({ queryKey: ["/api/sales/vas-progress"] });
  const vasProgress = (vasProgressRes as any) || { currentAmount: 0, targetAmount: 0, percentOfTarget: 0, percentVsPrevious: 0 };

  const { data: customersData } = useQuery({ queryKey: ["/api/customers?pageSize=1000"] });
  const allLeads = (customersData as any)?.customers || [];

  const { data: followupsRes } = useQuery({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
  const followupsData = (followupsRes as any)?.data?.items || [];

  const [actStartDate, setActStartDate] = useState<string>("");
  const [actEndDate, setActEndDate] = useState<string>("");

  const { data: activitiesRes, refetch: refetchActivities } = useQuery({ 
    queryKey: ["/api/sales/activity-plan", { from: actStartDate, to: actEndDate }],
    enabled: true
  });
  
  const realActivities = (activitiesRes as any)?.rows || [];

  const [followStartDate, setFollowStartDate] = useState<string>("");
  const [followEndDate, setFollowEndDate] = useState<string>("");
  const [activeFollowService, setActiveFollowService] = useState<string>("Alibaba Membership");
  const [followPage, setFollowPage] = useState<number>(1);
  const followPageSize = 10;

  const defaultActivities = [
    { m: "Mobile", tgt: "150 (0) 0%", tt: "0", dt: "0" },
    { m: "Whatsapp", tgt: "50 (0) 0%", tt: "0", dt: "0" },
    { m: "E-mail", tgt: "50 (0) 0%", tt: "0", dt: "0" },
    { m: "Seminar", tgt: "1 (0) 0%", tt: "0", dt: "0" }
  ];

  const handleActGo = () => {
    if (actStartDate && actEndDate) {
      refetchActivities();
    }
  };

  // Derive activitiesData dynamically
  const activitiesData = realActivities.length > 0 ? [
    { 
      m: "Mobile", 
      tgt: `${realActivities.find((r:any) => r.method === "mobile")?.target || 150} (${realActivities.find((r:any) => r.method === "mobile")?.actualCount || 0}) ${realActivities.find((r:any) => r.method === "mobile")?.targetPercent || 0}%`, 
      tt: realActivities.find((r:any) => r.method === "mobile")?.actual || "0", 
      dt: realActivities.find((r:any) => r.method === "mobile")?.defaultTime || "0" 
    },
    { 
      m: "Whatsapp", 
      tgt: `${realActivities.find((r:any) => r.method === "whatsapp")?.target || 50} (${realActivities.find((r:any) => r.method === "whatsapp")?.actualCount || 0}) ${realActivities.find((r:any) => r.method === "whatsapp")?.targetPercent || 0}%`, 
      tt: realActivities.find((r:any) => r.method === "whatsapp")?.actual || "0", 
      dt: realActivities.find((r:any) => r.method === "whatsapp")?.defaultTime || "0" 
    },
    { 
      m: "E-mail", 
      tgt: `${realActivities.find((r:any) => r.method === "email")?.target || 50} (${realActivities.find((r:any) => r.method === "email")?.actualCount || 0}) ${realActivities.find((r:any) => r.method === "email")?.targetPercent || 0}%`, 
      tt: realActivities.find((r:any) => r.method === "email")?.actual || "0", 
      dt: realActivities.find((r:any) => r.method === "email")?.defaultTime || "0" 
    },
    { 
      m: "Seminar", 
      tgt: `${realActivities.find((r:any) => r.method === "seminar")?.target || 1} (${realActivities.find((r:any) => r.method === "seminar")?.actualCount || 0}) ${realActivities.find((r:any) => r.method === "seminar")?.targetPercent || 0}%`, 
      tt: realActivities.find((r:any) => r.method === "seminar")?.actual || "0", 
      dt: realActivities.find((r:any) => r.method === "seminar")?.defaultTime || "0" 
    }
  ] : defaultActivities;

  const [appliedFollowStartDate, setAppliedFollowStartDate] = useState<string>("");
  const [appliedFollowEndDate, setAppliedFollowEndDate] = useState<string>("");

  const handleFollowFilter = () => {
    if (!followStartDate || !followEndDate) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Please select From and To date'
      });
      return;
    }
    setAppliedFollowStartDate(followStartDate);
    setAppliedFollowEndDate(followEndDate);
  };

  const handleTabClick = (serviceName: string) => {
    setActiveFollowService(serviceName);
    setFollowPage(1);
  };

  // Compute followData dynamically using applied dates
  const followData = followupsData
    .filter((row: any) => {
      if (appliedFollowStartDate && appliedFollowEndDate) {
        const rowDate = new Date(row.createdAt);
        const start = new Date(appliedFollowStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(appliedFollowEndDate);
        end.setHours(23, 59, 59, 999);
        if (rowDate < start || rowDate > end) return false;
      }
      const sType = row.serviceType || "Alibaba Membership";
      return sType === activeFollowService;
    })
    .map((row: any, index: number) => ({
      id: index + 1,
      company: row.company || row.companyName || "Unknown",
      service: activeFollowService,
      subtype: row.subserviceName || row.type || "General",
      grade: row.grade || "A", 
      purpose: row.purpose || "Follow Up",
      method: row.method || "Call",
      comment: row.notes || "-",
      person: row.salesPerson || row.createdBy || "System",
      note: row.notes || "None",
      next: row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "-",
      created: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"
    }));


  const handleActReset = () => {
    setActStartDate("");
    setActEndDate("");
  };

  const allStages = ["LD", "QF", "AY", "IN", "PM", "GM", "BV", "NC", "RC", "EC", "FW", "NF"];
  const maxVal = Math.max(...allStages.map(s => pipelineStages[s] || 0), 1);

  const targetDataOverall = allStages.map(s => ({
    label: s,
    val: pipelineStages[s] || 0,
    height: `h-[${Math.round(((pipelineStages[s] || 0) / maxVal) * 100)}%]`
  }));

  const targetDataAB = [
    { label: "LD", val: 5, height: "h-[100%]" },
    { label: "QF", val: 1, height: "h-[20%]" },
    { label: "AY", val: 4, height: "h-[80%]" },
    { label: "IN", val: 2, height: "h-[40%]" },
    { label: "PM", val: 1, height: "h-[20%]" },
    { label: "GM", val: 0, height: "h-[0%]" },
    { label: "BV", val: 3, height: "h-[60%]" },
    { label: "NC", val: 2, height: "h-[40%]" },
    { label: "RC", val: 1, height: "h-[20%]" },
    { label: "EC", val: 0, height: "h-[0%]" },
    { label: "FW", val: 0, height: "h-[0%]" },
    { label: "NF", val: 0, height: "h-[0%]" }
  ];

  const targetDataVAS = [
    { label: "LD", val: 0, height: "h-[0%]" },
    { label: "QF", val: 2, height: "h-[40%]" },
    { label: "AY", val: 1, height: "h-[20%]" },
    { label: "IN", val: 4, height: "h-[80%]" },
    { label: "PM", val: 5, height: "h-[100%]" },
    { label: "GM", val: 3, height: "h-[60%]" },
    { label: "BV", val: 0, height: "h-[0%]" },
    { label: "NC", val: 0, height: "h-[0%]" },
    { label: "RC", val: 2, height: "h-[40%]" },
    { label: "EC", val: 1, height: "h-[20%]" },
    { label: "FW", val: 1, height: "h-[20%]" },
    { label: "NF", val: 0, height: "h-[0%]" }
  ];

  const currentTargetData = activeTargetTab === "OverAll" ? targetDataOverall : activeTargetTab === "T-AB" ? targetDataAB : targetDataVAS;




  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      {/* Top Header / Breadcrumb */}
      <div className="mb-6 flex items-center text-[13px] font-bold text-gray-500 uppercase tracking-wide dark:text-zinc-400">
        <span className="text-gray-700 dark:text-zinc-400">DASHBOARD</span>
        <span className="mx-2">/</span>
        <span className="text-[#00a65a] dark:text-zinc-400">SALES DEPARTMENT</span>
        <span className="mx-2">/</span>
        <span className="text-gray-500 dark:text-zinc-400">SALES ASSISTANT MANAGER</span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Row 1: Top Selling + Image */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Top Selling</h2>
              <div className="w-28">
                <Select value={period} onValueChange={(val) => setPeriod(val.toUpperCase())}>
                  <SelectTrigger className="h-8 text-xs font-medium border-gray-300 dark:border-zinc-800">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TD">TD (Today)</SelectItem>
                    <SelectItem value="WC">WC (This Week)</SelectItem>
                    <SelectItem value="MC">MC (This Month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4 bg-gray-50/50 h-full">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const filteredLeads = allLeads.filter((l: any) => {
                    if (!l.createdAt) return false;
                    const date = new Date(l.createdAt);
                    const now = new Date();
                    if (period === "TD") return date.toDateString() === now.toDateString();
                    if (period === "WC") {
                      const firstDay = new Date(now);
                      firstDay.setDate(now.getDate() - now.getDay());
                      firstDay.setHours(0,0,0,0);
                      return date >= firstDay;
                    }
                    if (period === "MC") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    return true;
                  });

                  return [
                    { title: "Total Contact", val: `${filteredLeads.length}`, icon: Users },
                    { title: "New", val: `${filteredLeads.filter((l: any) => !l.purpose || l.purpose?.toLowerCase() === "new").length}`, icon: ArrowRightLeft },
                    { title: "Renew", val: `${filteredLeads.filter((l: any) => l.purpose?.toLowerCase() === "renew").length}`, icon: Tag },
                    { title: "Expire", val: `${filteredLeads.filter((l: any) => l.purpose?.toLowerCase() === "expire").length}`, icon: Target },
                    { title: "Vm", val: `${filteredLeads.filter((l: any) => l.serviceTypes?.includes("VM") || l.mainService?.includes("VM")).length}`, icon: Users },
                    { title: "Kwa", val: `${filteredLeads.filter((l: any) => l.serviceTypes?.includes("KWA") || l.mainService?.includes("KWA")).length}`, icon: ArrowRightLeft },
                    { title: "Psa", val: `${filteredLeads.filter((l: any) => l.serviceTypes?.includes("PSA") || l.mainService?.includes("PSA")).length}`, icon: Tag },
                    { title: "Sponsor Brand", val: `${filteredLeads.filter((l: any) => l.serviceTypes?.includes("Sponsor Brand") || l.mainService?.includes("Sponsor Brand")).length}`, icon: Target }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded shadow-sm border border-gray-100 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 mb-1 dark:text-zinc-400">{item.title}</div>
                        <div className="text-[18px] text-gray-700 dark:text-zinc-400">{item.val}</div>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-[#00a65a] text-white flex items-center justify-center">
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
          <div className="hidden lg:block w-[30%] bg-white p-2 border border-gray-100 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="h-full w-full rounded overflow-hidden">
              <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800&h=400" alt="Meeting" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Row 2: Activities | Target | Target Achive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Activities */}
          <div className="bg-white shadow-sm border border-gray-100 rounded flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Activities</h2>
              <div className="flex gap-1 items-center">
                <input 
                  type="date" 
                  value={actStartDate}
                  onChange={(e) => setActStartDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 h-7 text-xs w-[110px] dark:border-zinc-800" 
                />
                <span className="mx-0.5 text-gray-400">-</span>
                <input 
                  type="date" 
                  value={actEndDate}
                  onChange={(e) => setActEndDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 h-7 text-xs w-[110px] dark:border-zinc-800" 
                />
                <button onClick={handleActGo} className="bg-[#00a65a] text-white text-xs px-2 h-7 rounded ml-1 hover:bg-[#008d4c] transition-colors">Go</button>
                <button onClick={handleActReset} className="bg-gray-500 text-white text-xs px-2 h-7 rounded hover:bg-gray-600 transition-colors">Reset</button>
              </div>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-700 font-bold dark:text-zinc-400">Method</th>
                    <th className="text-center py-2 text-gray-700 font-bold dark:text-zinc-400">Target</th>
                    <th className="text-center py-2 text-gray-700 font-bold dark:text-zinc-400">Talk Time</th>
                    <th className="text-center py-2 text-gray-700 font-bold dark:text-zinc-400">Defult Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activitiesData.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-zinc-800">
                      <td className="py-2 text-gray-600 flex items-center gap-1 dark:text-zinc-300">
                        <div className="h-3 w-3 rounded-full border border-[#00a65a] flex items-center justify-center dark:border-zinc-800">
                          <div className="h-1.5 w-1.5 bg-[#00a65a] rounded-full"></div>
                        </div>
                        {row.m}
                      </td>
                      <td className="py-2 text-center text-gray-600 bg-gray-50/50 dark:text-zinc-300">{row.tgt}</td>
                      <td className="py-2 text-center text-gray-600 dark:text-zinc-300">{row.tt}</td>
                      <td className="py-2 text-center text-gray-600 bg-gray-50/50 dark:text-zinc-300">{row.dt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-center mt-3 pt-2 text-[11px] font-bold text-gray-600 border-t border-gray-50 dark:text-zinc-300 dark:border-zinc-800">
                Talk Time (0) W-H 8(480 M) Spent(0 M) Free(480 M)
              </div>
            </div>
          </div>

          {/* Target */}
          <div className="bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
            <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Target</h2>
              <div className="flex gap-3 text-xs font-bold text-gray-500 dark:text-zinc-400">
                <button onClick={() => setActiveTargetTab("OverAll")} className={`${activeTargetTab === "OverAll" ? "bg-[#00a65a] text-white" : "hover:text-gray-700"} px-3 py-1 rounded transition-colors`}>OverAll</button>
                <button onClick={() => setActiveTargetTab("T-AB")} className={`${activeTargetTab === "T-AB" ? "bg-[#00a65a] text-white" : "hover:text-gray-700"} px-3 py-1 rounded transition-colors`}>T-AB</button>
                <button onClick={() => setActiveTargetTab("T-VAS")} className={`${activeTargetTab === "T-VAS" ? "bg-[#00a65a] text-white" : "hover:text-gray-700"} px-3 py-1 rounded transition-colors`}>T-VAS</button>
              </div>
            </div>
            <div className="p-4 flex items-end justify-center h-[260px] gap-2 pb-6 border-b border-gray-100 relative dark:border-zinc-800">
              <div className="absolute w-full h-[1px] bg-gray-100 bottom-[40px] dark:bg-zinc-900"></div>
                {currentTargetData.map((bar, i) => (
                  <div key={i} className="flex flex-col items-center w-6 z-10 h-[180px] justify-end">
                    {bar.val > 0 && <span className="text-[10px] text-gray-400 mb-1">{bar.val}</span>}
                    {bar.val === 0 && <span className="text-[10px] text-gray-400 mb-1">0</span>}
                    <div 
                      className={`w-full bg-[#5c7cfa] rounded-t-sm min-h-[1px] transition-all duration-300`}
                      style={{ height: `${Math.round((bar.val / maxVal) * 100)}%` }}
                    ></div>
                  <span className="text-[10px] text-gray-400 mt-2">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side stacked (Target Achive + Quick Enteries + Appointment) */}
          <div className="flex flex-col gap-4">
            
            <div className="bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Target Achieve</h2>
              </div>
              <div className="p-4 flex items-center">
                <div className="flex-1">
                  <p className="text-[11px] text-gray-400 uppercase font-semibold mb-2">This month vas</p>
                  <p className="text-[20px] text-gray-600 font-bold mb-1 dark:text-zinc-300">RS {vasProgress.currentAmount?.toLocaleString()} / {vasProgress.targetAmount?.toLocaleString()}</p>
                  <p className={`text-[11px] mb-4 ${vasProgress.percentVsPrevious >= 0 ? "text-[#00a65a]" : "text-red-500"} dark:text-zinc-400`}>
                    {vasProgress.percentVsPrevious}% {vasProgress.percentVsPrevious >= 0 ? "↑" : "↓"} From previous period
                  </p>
                  <Link href="/reports/vas">
                    <button className="bg-[#00a65a] text-white text-[11px] px-3 py-1.5 rounded flex items-center gap-1 font-bold">
                      View More <span className="text-[12px] font-bold">→</span>
                    </button>
                  </Link>
                </div>
                <div className="w-[100px] flex flex-col items-center justify-center">
                  <div className="w-[80px] h-[80px] rounded-full border-[6px] border-[#00a65a] flex items-center justify-center dark:border-zinc-800" style={{borderTopColor: '#f3f4f6'}}>
                    <span className="text-[13px] text-gray-600 font-bold dark:text-zinc-300">{vasProgress.percentOfTarget}%</span>
                  </div>
                  <span className="text-[11px] text-gray-400 mt-2">Monthly</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                <h2 className="text-[17px] font-bold text-[#243b53] dark:text-zinc-100">Quick Enteries</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { lbl: "Duplication Check", to: "/sales/duplicate-checker" }, 
                  { lbl: "Private Pool", to: "/sales/lead-pools?pool=Private" },
                  { lbl: "Services Pool", to: "/sales/lead-pools?pool=Service" }, 
                  { lbl: "BV Checking", to: "/sales/lead-pools?pool=GMBV" },
                  { lbl: "Over Time", to: "/hr/overtime" }, 
                  { lbl: "Public Pool", to: "/sales/lead-pools?pool=Public" }
                ].map((item, i) => (
                  <Link key={i} href={item.to}>
                    <div className="bg-[#f8f9fa] px-4 py-3 flex items-center justify-between rounded-[4px] text-[13px] text-[#31435d] cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100">
                      {item.lbl}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white shadow-sm border border-gray-100 rounded flex-1 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="px-4 py-2.5 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
                <h2 className="text-[14px] font-bold text-gray-700 dark:text-zinc-400">Today Appointment</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="h-5 w-5 rounded-full border border-[#00a65a] flex items-center justify-center text-[#00a65a] cursor-pointer hover:bg-[#00a65a] hover:text-white transition-colors dark:border-zinc-800 dark:text-zinc-400">
                      <Plus className="h-3 w-3" />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-[1100px] p-0 border-0 rounded-lg overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                      <DialogTitle className="text-gray-600 font-bold text-[18px] dark:text-zinc-300">Create Appointment</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 bg-[#f8f9fa] dark:bg-zinc-900">
                      <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                          <label className="block text-[13px] font-bold text-gray-500 mb-2 dark:text-zinc-400">Name</label>
                          <Select>
                            <SelectTrigger className="w-full text-[13px] h-[38px] bg-white border-gray-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                              <SelectValue placeholder="Search Company Through Id/Name" />
                            </SelectTrigger>
                            <SelectContent>
                              {allLeads.length > 0 ? (
                                allLeads.map((lead: any) => (
                                  <SelectItem key={lead.id} value={lead.id.toString()}>{lead.companyName || `Company ${lead.id}`}</SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-data" disabled>No Companies Found</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-[13px] font-bold text-gray-500 mb-2 dark:text-zinc-400">Subject</label>
                          <div className="flex gap-3">
                            <input type="text" className="flex-1 border border-gray-200 rounded px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:border-[#00a65a] dark:bg-zinc-900 dark:border-zinc-800" />
                            <button className="bg-[#00a65a] text-white px-6 rounded font-bold text-[13px] hover:bg-[#008d4c] shadow-sm transition-colors h-[38px]">Create</button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-gray-600 font-bold text-[16px] mb-3 dark:text-zinc-300">In Process</h3>
                          <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <table className="w-full text-[13px]">
                              <thead className="border-b border-gray-200 bg-[#fbfcfd] dark:border-zinc-800 dark:bg-zinc-900">
                                <tr>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Company</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Meeting By</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Manager</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Com</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Time</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold dark:text-zinc-300">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td colSpan={6} className="text-center py-6 text-gray-500 dark:text-zinc-400">No Data Found</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-gray-600 font-bold text-[16px] mb-3 dark:text-zinc-300">End Meeting</h3>
                          <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <table className="w-full text-[13px]">
                              <thead className="border-b border-gray-200 bg-[#fbfcfd] dark:border-zinc-800 dark:bg-zinc-900">
                                <tr>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Company</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Meeting By</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">Start</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold border-r border-gray-100 dark:text-zinc-300 dark:border-zinc-800">End</th>
                                  <th className="text-left py-3 px-4 text-gray-600 font-bold dark:text-zinc-300">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td colSpan={5} className="text-center py-6 text-gray-500 dark:text-zinc-400">No Data Found</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4 text-center text-xs text-gray-500 font-medium h-[60px] flex items-center justify-center dark:text-zinc-400">
                No Important meetings found.
              </div>
            </div>

          </div>
        </div>

        {/* Row 3: Chart Data */}
        <div className="bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
          <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
            <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Chart Data</h2>
            <div className="w-[200px]">
              <Select value={chartStage} onValueChange={setChartStage}>
                <SelectTrigger className="h-8 text-xs border-gray-300 dark:border-zinc-800">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LD">LD (Lead)</SelectItem>
                    <SelectItem value="QF">QF (Qualify)</SelectItem>
                    <SelectItem value="AY">AY (Analysis)</SelectItem>
                    <SelectItem value="IN">IN (Invoice)</SelectItem>
                    <SelectItem value="PM">PM (Payment)</SelectItem>
                    <SelectItem value="GM">GM (Gold Member)</SelectItem>
                    <SelectItem value="BV">BV (Bussines Verification)</SelectItem>
                    <SelectItem value="NC">NC (New Customer)</SelectItem>
                    <SelectItem value="RC">RC (Renewal Customer)</SelectItem>
                    <SelectItem value="EC">EC (Expire Customer)</SelectItem>
                    <SelectItem value="FW">FW (Follow)</SelectItem>
                    <SelectItem value="NF">NF (Not Follow)</SelectItem>
                  </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-[12px] text-left">
              <thead className="bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">ID</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Company</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Account</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Email</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Phone</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Grade</th>
                  <th className="py-3 px-4 font-bold text-gray-700 dark:text-zinc-400">Create</th>
                </tr>
              </thead>
              <tbody>
                {chartOpportunities.length > 0 ? (
                  chartOpportunities.map((op: any) => (
                    <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-400">{op.id.slice(0, 8)}</td>
                      <td className="py-3 px-4 font-medium text-gray-700 dark:text-zinc-300">{op.customer?.companyName || "N/A"}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-400">{op.customer?.accountName || "N/A"}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-400">{op.customer?.email || "N/A"}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-400">{op.customer?.phone || "N/A"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          op.customer?.grade?.includes('A') ? 'bg-green-100 text-green-700' :
                          op.customer?.grade?.includes('B') ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {op.customer?.grade || "C"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-zinc-500">{new Date(op.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-500 font-bold border-b border-gray-100 dark:text-zinc-400 dark:border-zinc-800">
                      No Data Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 4: Follow Up Details */}
        <div className="bg-white shadow-sm border border-gray-100 rounded dark:bg-zinc-900 dark:border-zinc-800">
          <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
            <h2 className="text-[15px] font-bold text-gray-700 dark:text-zinc-400">Follow Up Details</h2>
            <div className="flex gap-1 items-center">
              <input 
                type="date" 
                value={followStartDate}
                onChange={(e) => setFollowStartDate(e.target.value)}
                className="border border-gray-300 rounded px-2 h-7 text-xs w-[120px] dark:border-zinc-800" 
              />
              <span className="mx-0.5 text-gray-400">-</span>
              <input 
                type="date" 
                value={followEndDate}
                onChange={(e) => setFollowEndDate(e.target.value)}
                className="border border-gray-300 rounded px-2 h-7 text-xs w-[120px] dark:border-zinc-800" 
              />
              <button onClick={handleFollowFilter} className="bg-[#00a65a] text-white text-xs px-4 h-7 rounded font-medium ml-1 hover:bg-[#008d4c] transition-colors">Filter</button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 rounded overflow-hidden text-center text-white text-xs font-medium mb-4">
              <div onClick={() => handleTabClick("Alibaba Membership")} className={`bg-[#38c172] py-2.5 shadow-inner cursor-pointer transition-opacity ${activeFollowService === "Alibaba Membership" ? "opacity-100" : "opacity-60 hover:opacity-80"}`}>Alibaba Membership {followupsData.filter((r: any) => (r.serviceType || "Alibaba Membership") === "Alibaba Membership").length}</div>
              <div onClick={() => handleTabClick("Alibaba Services")} className={`bg-[#e3342f] py-2.5 shadow-inner cursor-pointer transition-opacity ${activeFollowService === "Alibaba Services" ? "opacity-100" : "opacity-60 hover:opacity-80"}`}>Alibaba Services {followupsData.filter((r: any) => r.serviceType === "Alibaba Services").length}</div>
              <div onClick={() => handleTabClick("Design Development")} className={`bg-[#3490dc] py-2.5 shadow-inner cursor-pointer transition-opacity ${activeFollowService === "Design Development" ? "opacity-100" : "opacity-60 hover:opacity-80"}`}>Design Development {followupsData.filter((r: any) => r.serviceType === "Design Development").length}</div>
              <div onClick={() => handleTabClick("Domain Hosting")} className={`bg-[#343a40] py-2.5 shadow-inner cursor-pointer transition-opacity ${activeFollowService === "Domain Hosting" ? "opacity-100" : "opacity-60 hover:opacity-80"}`}>Domain Hosting {followupsData.filter((r: any) => r.serviceType === "Domain Hosting").length}</div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-zinc-300">
                Show 
                <select className="border border-gray-300 rounded p-1 outline-none dark:border-zinc-800" disabled>
                  <option value="10">10</option>
                </select> 
                entries
              </div>
              <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-zinc-300">
                Search:
                <input type="text" className="border border-gray-300 rounded px-2 py-1 w-[150px] dark:border-zinc-800" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] text-left">
                <thead className="bg-white border-b border-t border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">#</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Company</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Main Service</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Sub Type</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Grade</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Purpose</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Method</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Comment</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Sale Person</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Followup Note</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Next Date</th>
                    <th className="py-3 px-2 font-bold text-gray-700 dark:text-zinc-400">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {followData.length > 0 ? (
                    followData
                      .slice((followPage - 1) * followPageSize, followPage * followPageSize)
                      .map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.id}</td>
                        <td className="py-2 px-2 text-gray-600 font-medium dark:text-zinc-300">{row.company}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.service}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.subtype}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.grade}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.purpose}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.method}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.comment}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.person}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.note}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.next}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-zinc-300">{row.created}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-6 px-2 text-gray-500 border-b border-gray-100 text-center dark:text-zinc-400 dark:border-zinc-800">
                        Please Select Filter to see the data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-between items-center text-xs text-gray-500 dark:text-zinc-400">
              <div>
                Showing {followData.length > 0 ? (followPage - 1) * followPageSize + 1 : 0} to {Math.min(followPage * followPageSize, followData.length)} of {followData.length} entries
              </div>
              <div className="flex gap-1 items-center">
                <button
                  onClick={() => setFollowPage(p => Math.max(1, p - 1))}
                  disabled={followPage === 1}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.ceil(followData.length / followPageSize) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(followData.length / followPageSize) || Math.abs(p - followPage) <= 1)
                  .reduce((acc: (number | string)[], p, idx, arr) => {
                    if (idx > 0 && (arr[idx - 1] as number) < p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setFollowPage(p as number)}
                        className={`w-7 h-7 rounded border text-xs font-medium transition-colors ${
                          followPage === p
                            ? 'bg-[#00a65a] text-white border-[#00a65a]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                }
                <button
                  onClick={() => setFollowPage(p => Math.min(Math.ceil(followData.length / followPageSize), p + 1))}
                  disabled={followPage >= Math.ceil(followData.length / followPageSize)}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
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
