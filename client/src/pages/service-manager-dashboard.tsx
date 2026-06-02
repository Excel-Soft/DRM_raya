import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Tag, Target, ArrowRightLeft, ChevronRight, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import CheckDuplicationPage from "@/pages/CheckDuplicationPage";
import ServicePrivatePool from "@/pages/service-private-pool";
import ServicePoolDashboard from "@/pages/service-pool-dashboard";
import ServiceLeaveApplication from "@/pages/service-leave-application";
import ServiceLoanApplication from "@/pages/service-loan-application";
import ServiceBvChecking from "@/pages/service-bv-checking";
import ServiceOvertime from "@/pages/service-overtime";
import ServiceGradeList from "@/pages/service-grade-list";
import ServiceAddPenalty from "@/pages/service-add-penalty";
import ServiceCommissionVerifications from "@/pages/service-commission-verifications";

export default function ServiceManagerDashboard() {
    const [teamWorkStartDate, setTeamWorkStartDate] = useState("");
    const [teamWorkEndDate, setTeamWorkEndDate] = useState("");
    const [activeView, setActiveView] = useState("dashboard");
    const [kpiPeriod, setKpiPeriod] = useState("WC");
    const [activityPeriod, setActivityPeriod] = useState("TD");

    const { data: summaryRes, isLoading: loadingSummary } = useQuery<any>({
        queryKey: [`/api/service/manager/stats`],
    });

    const { data: activitiesRes, isLoading: loadingActivities } = useQuery<any>({
        queryKey: [`/api/service/manager/activities`],
    });

    const { data: trendRes, isLoading: loadingTrend } = useQuery<any>({
        queryKey: ["/api/service/manager/current-month-graph"],
    });

    const { data: teamQueueRes } = useQuery<any>({
        queryKey: ["/api/service/manager/queue-performance"],
    });

    const { data: teamWorkRes } = useQuery<any>({
        queryKey: ["/api/service/manager/team-work-performance"],
    });

    const summary = summaryRes || {};
    const teamPerformance = [
        { title: "Total Revenue", value: `${summary.totalRevenue || 0}$`, icon: Users },
        { title: "New", value: `${summary.new || 0}`, icon: ArrowRightLeft },
        { title: "Renew", value: `${summary.renew || 0}`, icon: Tag },
        { title: "Expire", value: `${summary.expire || 0}`, icon: Target },
        { title: "In Service", value: `${summary.inService || 0}`, icon: Users },
        { title: "Kwa", value: `${summary.kwa || 0}`, icon: ArrowRightLeft },
        { title: "Psa", value: `${summary.psa || 0}`, icon: Tag },
        { title: "Sponsor Brand", value: `${summary.sponsorBrand || 0}`, icon: Target },
    ];

    const activities = Array.isArray(activitiesRes) ? activitiesRes : [];

    const teamQueue = Array.isArray(teamQueueRes) ? teamQueueRes : [];

    const chartData = Array.isArray(trendRes) ? trendRes : [];

    const quickEntries = [
        "Duplication Check", "Private Pool", "Services Pool", "Leave Application",
        "Loan Application", "BV Checking", "Over Time", "Grade List", "Add Penalty", "Commission Verifications"
    ];

    const teamWorkPerformance = Array.isArray(teamWorkRes) ? teamWorkRes : [];

    if (activeView === "duplication") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <CheckDuplicationPage />
                </div>
            </div>
        );
    }

    if (activeView === "private-pool") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServicePrivatePool />
                </div>
            </div>
        );
    }

    if (activeView === "service-pool") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServicePoolDashboard />
                </div>
            </div>
        );
    }

    if (activeView === "leave-application") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceLeaveApplication />
                </div>
            </div>
        );
    }

    if (activeView === "loan-application") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceLoanApplication />
                </div>
            </div>
        );
    }

    if (activeView === "bv-checking") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceBvChecking />
                </div>
            </div>
        );
    }

    if (activeView === "overtime") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceOvertime />
                </div>
            </div>
        );
    }

    if (activeView === "grade-list") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceGradeList />
                </div>
            </div>
        );
    }

    if (activeView === "add-penalty") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceAddPenalty />
                </div>
            </div>
        );
    }

    if (activeView === "commission-verifications") {
        return (
            <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans">
                <div className="pt-6 px-6 pb-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>
                <div className="-mt-4">
                    <ServiceCommissionVerifications />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
            <div className="mb-6 px-2">
                <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 uppercase tracking-tight">
                    DASHBOARD <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">/ SERVICE DEPARTMENT</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Left Column (Activities, Queue, Performance widgets) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Team Performance */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Team Performance</h3>
                            <Select defaultValue="wc">
                                <SelectTrigger className="w-24 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="wc">WC</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {teamPerformance.map((stat, i) => (
                                <div key={i} className="bg-white border border-slate-100 p-4 rounded-md flex justify-between items-center shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                    <div>
                                        <p className="text-[12px] text-slate-500 font-semibold mb-1 dark:text-zinc-400">{stat.title}</p>
                                        <p className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">{stat.value}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-[#059669] flex items-center justify-center text-white shrink-0">
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activities */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Activities</h3>
                            <Select defaultValue="td">
                                <SelectTrigger className="w-24 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="td">TD</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="overflow-x-auto rounded border border-[#059669]/20 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#059669]/10">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Name</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Mobile<br />(15)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">OnSite<br />Visit (1)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Whatsapp<br />(20)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">VAS<br />Call (5)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">E-<br />mail (5)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Webinar<br />(1)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Seminar<br />(1)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Copy<br />Product (10)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">New<br />Product (5)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">ShowCase<br />(5)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Diagnose<br />(1)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">W-<br />Call (50)</TableHead>
                                        <TableHead className="text-[11px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 p-2 text-center h-auto whitespace-nowrap">Total<br />Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-b-0 hover:bg-slate-50/50">
                                        <TableCell colSpan={14} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">No data available in table</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Team Queue Sale Performance */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Team Queue Sale Performance</h3>
                            <div className="flex items-center gap-2">
                                <Select defaultValue="choose">
                                    <SelectTrigger className="w-28 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="choose">Choose</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select defaultValue="month">
                                    <SelectTrigger className="w-24 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="month">Month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded border border-[#059669]/20 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#059669]/10">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3 pl-4">#</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Person</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Total</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Target</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Achive</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Remain</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">A-</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">Prediction</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">GM</TableHead>
                                        <TableHead className="text-[12px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3">BV</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-b-0 hover:bg-slate-50/50">
                                        <TableCell colSpan={10} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">No data available in table</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Right Column (Banner, Chart, Meetings, Quick Entries) */}
                <div className="space-y-6">
                    {/* Promotion Baners */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Promotion Baners</h3>
                        <div className="h-32 w-full bg-[#fcd5ce] rounded shadow-inner overflow-hidden relative flex items-center justify-center dark:bg-zinc-900">
                            <div className="absolute inset-0 opacity-50 bg-[url('https://images.unsplash.com/photo-1550989460-0adf9ea622e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80')] bg-cover bg-center mix-blend-multiply"></div>
                            <ChevronLeft className="absolute left-2 text-white/70 h-8 w-8 cursor-pointer hover:text-white" />
                            <ChevronRight className="absolute right-2 text-white/70 h-8 w-8 cursor-pointer hover:text-white" />
                        </div>
                    </div>

                    {/* Current Month Achievement */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Current Month</h3>
                        <div className="h-[200px] w-full">
                            {/* Added responsive layout container */}
                            <div dangerouslySetInnerHTML={{ __html: `<style>.recharts-wrapper { font-family: sans-serif; }</style>` }} />
                            <div className="flex h-full items-center">
                                <div className="origin-center -rotate-90 whitespace-nowrap text-[11px] text-slate-400 -ml-16 mr-[-50px]">Current Month Team Achievement</div>
                                <div className="flex-1 h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="x" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <YAxis axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 5]} tickCount={6} />
                                            <Line type="monotone" dataKey="y" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669', strokeWidth: 0 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Team Meeting */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Daily Team Meeting</h3>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-slate-100 dark:border-zinc-800">
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-2 dark:text-zinc-400">
                                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Person</span>
                                        </TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-2 dark:text-zinc-400">Start</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-2 dark:text-zinc-400">End</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-2 dark:text-zinc-400">Total</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-2 dark:text-zinc-400">Detail</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-b-0 hover:bg-slate-50/50">
                                        <TableCell colSpan={5} className="text-center py-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">No meeting scheduled.</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Quick Entries */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Quick Enteries</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {quickEntries.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (item === "Duplication Check") setActiveView("duplication");
                                        if (item === "Private Pool") setActiveView("private-pool");
                                        if (item === "Services Pool") setActiveView("service-pool");
                                        if (item === "Leave Application") setActiveView("leave-application");
                                        if (item === "Loan Application") setActiveView("loan-application");
                                        if (item === "BV Checking") setActiveView("bv-checking");
                                        if (item === "Over Time") setActiveView("overtime");
                                        if (item === "Grade List") setActiveView("grade-list");
                                        if (item === "Add Penalty") setActiveView("add-penalty");
                                        if (item === "Commission Verifications") setActiveView("commission-verifications");
                                    }}
                                    className="flex items-center justify-between px-3 py-2 bg-slate-50/50 hover:bg-slate-100 border border-slate-100 rounded cursor-pointer transition-colors group dark:border-zinc-800 dark:hover:bg-zinc-800"
                                >
                                    <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 tracking-tight dark:text-zinc-300">{item}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Full width - Team Work Performance */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 mb-6 dark:bg-zinc-900">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">Team Work Performance</h3>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={teamWorkStartDate}
                            onChange={(e) => setTeamWorkStartDate(e.target.value)}
                            className="h-8 w-[150px] border-slate-200 text-[13px] dark:border-zinc-800"
                            placeholder="Start Date"
                        />
                        <Input
                            type="date"
                            value={teamWorkEndDate}
                            onChange={(e) => setTeamWorkEndDate(e.target.value)}
                            className="h-8 w-[150px] border-slate-200 text-[13px] dark:border-zinc-800"
                            placeholder="End Date"
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <span className="inline-block px-4 py-1.5 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-full border border-slate-200 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900">All Team</span>
                </div>

                <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20">
                            <TableRow className="border-slate-100 hover:bg-transparent dark:border-zinc-800">
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Name</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Leads</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Follow</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Not<br />Follow</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">A-<br />Cus</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">B+<br />Cus</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">B<br />Csu</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">B-<br />Csu</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Report</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Start<br />Rating</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Up<br />Selling</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Rfq</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Products</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Follow<br />Rate</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Sample</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Order</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Revenue</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Happay<br />With<br />Alibaba</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Happay<br />With<br />Webxl</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Call<br />Connected</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Not<br />Response</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Appointment</TableHead>
                                <TableHead className="text-[11px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Meeting</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamWorkPerformance.map((row, idx) => (
                                <TableRow key={idx} className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <TableCell className="text-[12px] font-medium text-slate-700 py-3 whitespace-nowrap dark:text-zinc-400">{row.name}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.leads}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.follow}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.notFollow}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.aMinusCus}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.bPlusCus}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.bCus}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.bMinusCsu}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.report}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.startRating}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.upSelling}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.rfq}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.products}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.followRate}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.sample}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.order}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.revenue}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.happyAlibaba}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.happyWebxl}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.callConnected}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.notResponse}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.appointment}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 tabular-nums dark:text-zinc-300">{row.meeting}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
