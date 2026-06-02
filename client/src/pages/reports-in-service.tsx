import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Users, BookOpen, CheckCircle2 } from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

export default function ReportsInService() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeQuarter, setActiveQuarter] = useState("q1");

  // Mock data for Donut Chart
  const pieData = [
    { name: "Target", value: 45, color: "#4f46e5" }, // Indigo
    { name: "Achieved", value: 15, color: "#10b981" }, // Emerald
    { name: "Remaining", value: 40, color: "#f43f5e" }, // Rose
  ];

  // Mock data for Composed Chart
  const chartData = [
    { name: "Apr 2026", target: 70, done: 40, percentage: 60 },
    { name: "May 2026", target: 60, done: 5, percentage: 8 },
    { name: "Jun 2026", target: 45, done: 0, percentage: 0 },
    { name: "Jul 2026", target: 80, done: 0, percentage: 0 },
    { name: "Aug 2026", target: 30, done: 0, percentage: 0 },
    { name: "Sep 2026", target: 30, done: 0, percentage: 0 },
    { name: "Oct 2026", target: 40, done: 0, percentage: 0 },
    { name: "Nov 2026", target: 45, done: 0, percentage: 0 },
    { name: "Dec 2026", target: 60, done: 0, percentage: 0 },
    { name: "Jan 2027", target: 50, done: 0, percentage: 0 },
    { name: "Feb 2027", target: 50, done: 0, percentage: 0 },
    { name: "Mar 2027", target: 60, done: 0, percentage: 0 },
  ];

  const quarters = [
    { id: "q1", name: "Q1 Apr-Jun", count: 288, months: ["April", "May", "June"] },
    { id: "q2", name: "Q2 Jul-Sep", count: 266, months: ["July", "August", "September"] },
    { id: "q3", name: "Q3 Oct-Dec", count: 287, months: ["October", "November", "December"] },
    { id: "q4", name: "Q4 Jan-Mar", count: 460, months: ["January", "February", "March"] },
  ];

  const activeQuarterData = quarters.find(q => q.id === activeQuarter);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-4">
        IN SERVICE CUSTOMER COMPARE CUSTOMER
      </h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2 relative">
          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
          <div className="relative">
            <Input 
              type="date" 
              className="bg-white dark:bg-zinc-900 pl-3 pr-10 border-slate-200 dark:border-zinc-800"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2 relative">
          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
          <div className="relative">
            <Input 
              type="date" 
              className="bg-white dark:bg-zinc-900 pl-3 pr-10 border-slate-200 dark:border-zinc-800"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart Card */}
        <Card className="border-none shadow-sm dark:bg-zinc-900 lg:col-span-1">
          <CardContent className="p-6">
            <h2 className="font-semibold text-slate-700 dark:text-zinc-300 mb-6">
              Current Quarter <span className="text-[#4f46e5]">Apr</span> To <span className="text-[#f43f5e]">Jun</span>
            </h2>
            
            <div className="flex">
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded-sm bg-[#4f46e5]"></div>
                  <span className="text-sm text-slate-500">Target</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded-sm bg-[#10b981]"></div>
                  <span className="text-sm text-slate-500">Achieved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded-sm bg-[#f43f5e]"></div>
                  <span className="text-sm text-slate-500">Remaining</span>
                </div>
              </div>
              
              <div className="flex-1 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bar/Line Chart Card */}
        <Card className="border-none shadow-sm dark:bg-zinc-900 lg:col-span-2">
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    label={{ value: 'Number of account', angle: -90, position: 'insideLeft', offset: -10, style: { fill: '#64748b', fontSize: 12 } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(value) => `${value} %`}
                    label={{ value: 'Percentage', angle: -90, position: 'insideRight', offset: -10, style: { fill: '#64748b', fontSize: 12 } }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="rect"
                    wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
                  />
                  
                  <Bar yAxisId="left" dataKey="done" name="Done" fill="#10b981" barSize={20} radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="target" name="Target" fill="#4f46e5" barSize={20} radius={[2, 2, 0, 0]} />
                  
                  <Line 
                    yAxisId="right" 
                    type="linear" 
                    dataKey="percentage" 
                    name="Percentage" 
                    stroke="#f43f5e" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#ffffff', stroke: '#f43f5e', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    label={{ position: 'top', fill: '#0f172a', fontSize: 12, formatter: (val: number) => `${val}%` }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* In Service Customer Section */}
      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300 mb-6 text-lg">
            In Service Customer
          </h2>

          {/* Quarter Tabs */}
          <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-8 overflow-x-auto">
            {quarters.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveQuarter(q.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors relative
                  ${activeQuarter === q.id 
                    ? "text-[#10b981]" 
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
              >
                {q.name}
                <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-xs">
                  {q.count}
                </span>
                {activeQuarter === q.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]" />
                )}
              </button>
            ))}
          </div>

          {/* Month Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeQuarterData?.months.map((month) => (
              <Card key={month} className="border border-slate-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                <CardContent className="p-5">
                  <h3 className="text-center font-semibold text-slate-700 dark:text-zinc-300 mb-6">
                    {month}
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium mb-1">Total</span>
                      <span className="text-xl font-bold">0</span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
                      <Users className="h-5 w-5" />
                    </div>

                    <div className="w-px h-10 bg-slate-100 dark:bg-zinc-800"></div>

                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium mb-1">Pending</span>
                      <span className="text-xl font-bold">0</span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500">
                      <BookOpen className="h-5 w-5" />
                    </div>

                    <div className="w-px h-10 bg-slate-100 dark:bg-zinc-800"></div>

                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium mb-1">Renewed</span>
                      <span className="text-xl font-bold">0</span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
