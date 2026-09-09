import { useState } from "react";
import { ArrowRightCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";

const defaultActivities = [
    { method: "Mobile", target: "15 () 0%", time: 0 },
    { method: "OnSite Visit", target: "1 () 0%", time: 0 },
    { method: "Whatsapp", target: "20 () 0%", time: 0 },
    { method: "VAS Call", target: "5 () 0%", time: 0 },
    { method: "E-mail", target: "5 () 0%", time: 0 },
    { method: "Webinar", target: "1 () 0%", time: 0 },
    { method: "Seminar", target: "1 () 0%", time: 0 },
    { method: "Copy Product", target: "10 () 0%", time: 0 },
    { method: "New Product", target: "5 () 0%", time: 0 },
    { method: "ShowCase", target: "5 () 0%", time: 0 },
];

const defaultTargetData = [
    { name: "LD", value: 0 },
    { name: "QF", value: 0 },
    { name: "AY", value: 2 },
    { name: "IN", value: 0 },
    { name: "PM", value: 0 },
    { name: "GM", value: 0 },
    { name: "BV", value: 0 },
    { name: "NC", value: 0 },
    { name: "RC", value: 0 },
    { name: "EC", value: 0 },
    { name: "FW", value: 0 },
    { name: "NF", value: 0 },
];



export function ActivitiesTargetWidget() {
    const [targetFilter, setTargetFilter] = useState<"overall" | "t-ab" | "t-vas">("overall");

    const { data: activitiesRes } = useQuery<any[]>({
        queryKey: ["/api/service/executive/activities"],
    });

    const { data: targetRes } = useQuery<any>({
        queryKey: ["/api/service/executive/targets"],
    });

    const activities = Array.isArray(activitiesRes) && activitiesRes.length > 0 ? activitiesRes : defaultActivities;
    const targetData = targetRes?.overall || defaultTargetData;
    const tAbData = targetRes?.ab || [];
    const tVasDataDynamic = targetRes?.vas || [];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Activities Card */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-5 col-span-1 relative overflow-hidden dark:bg-zinc-900">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-80" />
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight dark:text-zinc-100">Activities</h2>
                    <Select defaultValue="TD">
                        <SelectTrigger className="w-20 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                            <SelectValue placeholder="TD" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TD">TD</SelectItem>
                            <SelectItem value="WK">WK</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-[13px] font-bold text-slate-700 mb-2 px-1 dark:text-zinc-400">
                    <div className="col-span-6">Method</div>
                    <div className="col-span-4 text-center">Target</div>
                    <div className="col-span-2 text-center">Time</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1.5">
                    {activities.map((act, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 text-[13px] items-center border-b border-slate-50 pb-1.5 px-1 last:border-0 last:pb-0 dark:border-zinc-800">
                            <div className="col-span-6 flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                                <ArrowRightCircle className="w-3.5 h-3.5 text-[#10b981] dark:text-zinc-100" strokeWidth={2.5} />
                                {act.method}
                            </div>
                            <div className="col-span-4 text-center text-slate-600 bg-slate-100/80 rounded px-1 py-0.5 dark:text-zinc-300">
                                {act.target}
                            </div>
                            <div className="col-span-2 text-center text-slate-600 bg-slate-100/80 rounded px-1 py-0.5 dark:text-zinc-300">
                                {act.time}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Target Card */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-5 col-span-1 md:col-span-2 overflow-hidden flex flex-col relative dark:bg-zinc-900">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-400 opacity-80" />
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[16px] font-extrabold text-slate-800 tracking-tight dark:text-zinc-100">Target</h2>
                    <div className="flex gap-1.5 lg:gap-2 items-center bg-slate-100/60 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-zinc-800">
                        <button
                            onClick={() => setTargetFilter("overall")}
                            className={`text-[13px] font-bold px-5 py-1.5 rounded-lg transition-all ${targetFilter === "overall" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-white dark:bg-zinc-900"}`}
                        >
                            OverAll
                        </button>
                        <button
                            onClick={() => setTargetFilter("t-ab")}
                            className={`text-[13px] font-bold px-5 py-1.5 rounded-lg transition-all ${targetFilter === "t-ab" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-white dark:bg-zinc-900"}`}
                        >
                            T-AB
                        </button>
                        <button
                            onClick={() => setTargetFilter("t-vas")}
                            className={`text-[13px] font-bold px-5 py-1.5 rounded-lg transition-all ${targetFilter === "t-vas" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-white dark:bg-zinc-900"}`}
                        >
                            T-VAS
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-[280px]">
                    {targetFilter === "overall" && (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={targetData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 13 }}
                                    dy={10}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="url(#colorUv)"
                                    radius={[6, 6, 0, 0]}
                                    label={{ position: 'top', fill: '#64748b', fontSize: 13, dy: -5, fontWeight: 'bold' }}
                                />
                                <defs>
                                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={1} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    )}

                    {targetFilter === "t-ab" && (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">#</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Target</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Bonus</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Price/Target</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Reward</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Kwa</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Vas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tAbData.length > 0 ? tAbData.map((row: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{idx + 1}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.target}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.bonus}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.price}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.reward}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.kwa}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.vas}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="border border-slate-100 p-4 text-center text-[13px] text-slate-400 dark:border-zinc-800">No data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {targetFilter === "t-vas" && (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">#</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Target</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Bonus</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Price/Target</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Reward</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Kwa</th>
                                        <th className="border border-slate-100 p-3 text-[13px] font-bold text-slate-700 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">Vas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tVasDataDynamic.length > 0 ? tVasDataDynamic.map((row: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{idx + 1}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.target}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.bonus || row.bouns}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.price}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.reward}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.kwa}</td>
                                            <td className="border border-slate-100 p-3 text-[13px] text-slate-600 bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.vas}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="border border-slate-100 p-4 text-center text-[13px] text-slate-400 dark:border-zinc-800">No data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
