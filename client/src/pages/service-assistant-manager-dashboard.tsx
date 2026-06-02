import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Tag, Target, ArrowRightLeft, ChevronRight, ChevronLeft, Plus, Play } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { ServiceQuickEntriesCard } from "@/components/service-quick-entries-card";
import { InServiceModal } from "@/components/in-service-modal";

export default function ServiceAssistantManagerDashboard() {
    const [, setLocation] = useLocation();
    const [inServiceModalOpen, setInServiceModalOpen] = useState(false);
    const [targetView, setTargetView] = useState<'overall' | 't-ab' | 't-vas'>('overall');
    const [customerMonthlyFilter, setCustomerMonthlyFilter] = useState<'gm' | 'bv'>('gm');
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

    const [followCompany, setFollowCompany] = useState('');
    const [followPurpose, setFollowPurpose] = useState('');
    const [followGrade, setFollowGrade] = useState('');
    const [followService, setFollowService] = useState('');
    const [followMethod, setFollowMethod] = useState('');
    const [followReservation, setFollowReservation] = useState('');
    const [followNextDate, setFollowNextDate] = useState('');
    const [followNote, setFollowNote] = useState('');

    const [apptName, setApptName] = useState('');
    const [apptSubject, setApptSubject] = useState('');
    const [inProcessAppointments, setInProcessAppointments] = useState<any[]>([]);

    const handleFollowSubmit = () => {
        alert("Follow Customer Submitted for: " + (followCompany || "None"));
        // Additional API or logic integration here
    };

    const handleCreateAppointment = () => {
        if (apptName && apptSubject) {
            setInProcessAppointments([...inProcessAppointments, {
                id: Date.now(),
                company: apptName,
                meetingBy: 'Admin',
                manager: 'Admin',
                com: apptSubject,
                time: new Date().toLocaleString(),
                action: 'Pending'
            }]);
            setApptName('');
            setApptSubject('');
        }
    };

    const topSelling = [
        { title: "Total Contact", value: "22(0)", icon: Users },
        { title: "New", value: "1(799)$", icon: ArrowRightLeft },
        { title: "Renew", value: "0(0)$", icon: Tag },
        { title: "Expire", value: "0(0)$", icon: Target },
        { title: "Vm", value: "0(0)$", icon: Users },
        { title: "Kwa", value: "0(0)$", icon: ArrowRightLeft },
        { title: "Psa", value: "0(0)$", icon: Tag },
        { title: "Sponsor Brand", value: "0(0)$", icon: Target },
    ];

    const targetData = [
        { name: 'LD', count: 2 },
        { name: 'QF', count: 0 },
        { name: 'AY', count: 2 },
        { name: 'IN', count: 3 },
        { name: 'PM', count: 3 },
        { name: 'GM', count: 1 },
        { name: 'BV', count: 1 },
        { name: 'NC', count: 1 },
        { name: 'RC', count: 0 },
        { name: 'EC', count: 0 },
        { name: 'FW', count: 0 },
        { name: 'NF', count: 0 },
    ];

    const quickEntries = [
        "Duplication Check", "Private Pool", "Service Pool", "BV Checking", "Over Time", "Public Pool", "New In Service"
    ];

    const importantStats = [
        { label: "In Service", value: "0" },
        { label: "A- Followup", value: "0" },
        { label: "B+ Followup", value: "0" },
        { label: "B Followup", value: "0" },
        { label: "B- Followup", value: "0" },
        { label: "30-Days Followup", value: "0" },
        { label: "7-Day Dropout", value: "0" },
        { label: "Dropout Leads", value: "0" },
        { label: "Complaints", value: "0" },
        { label: "Not Follow Yet", value: "0" },
        { label: "BV Document", value: "1" },
        { label: "VAS Document", value: "3" },
        { label: "Due Payment", value: "0" },
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
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
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
                            <Select defaultValue="choose">
                                <SelectTrigger className="w-28 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="choose">Choose</SelectItem>
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
                                <Select defaultValue="td">
                                    <SelectTrigger className="w-20 h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="td">TD</SelectItem>
                                        <SelectItem value="wk">WK</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-[12px] font-semibold text-slate-600 mb-2 flex justify-between px-2 dark:text-zinc-300">
                                <span>Method</span>
                                <span>Target</span>
                                <span>Time</span>
                            </div>
                            <div className="text-center mt-8 text-[12px] text-slate-500 font-medium px-2 dark:text-zinc-400">
                                Talk Time () W-H 8(480 M) Spent(0 M)
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
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">1</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(200000-249000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">200000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">10000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">2</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(150000-199000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">150000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">7500</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">3</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(100000-149000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">100000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">5000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="text-[13px] text-slate-600 dark:text-zinc-400">4</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">VAS(50000-99000)</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">15%</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">50000</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">2500</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                                <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">0</TableCell>
                                            </TableRow>
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
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
                                <p className="text-[18px] font-bold text-slate-700 mb-1 dark:text-zinc-400">RS 0 / <span className="text-[15px] text-slate-500 dark:text-zinc-400">T</span></p>
                                <p className="text-[12px] text-emerald-500 font-semibold mb-6">0% ↑ <span className="text-slate-400 font-normal">From previous period</span></p>
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
                                    </svg>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                        <span className="text-[16px] font-bold text-slate-400">0%</span>
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
                                        <Select value={followCompany} onValueChange={setFollowCompany}>
                                            <SelectTrigger className="w-full h-10 border-slate-200 text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                                <SelectValue placeholder="Search Company Through Id/Name" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Company A">Company A</SelectItem>
                                                <SelectItem value="Company B">Company B</SelectItem>
                                            </SelectContent>
                                        </Select>

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

                                        {/* Grade */}
                                        <div className="flex items-center gap-4 text-[13px]">
                                            <span className="text-[#059669] font-medium w-24 dark:text-zinc-400">Grade * :</span>
                                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                                {['A+', 'A-', 'B+', 'B-', 'B', 'C+', 'C', 'D'].map(g => (
                                                    <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="grade" 
                                                            className="accent-[#059669]"
                                                            checked={followGrade === g}
                                                            onChange={() => setFollowGrade(g)}
                                                        />
                                                        {g}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Service & Method */}
                                        <div className="flex gap-6 pt-2">
                                            <div className="flex-1 flex items-center gap-4 text-[13px]">
                                                <span className="text-[#059669] font-medium w-24 shrink-0 dark:text-zinc-400">Service * :</span>
                                                <Select value={followService} onValueChange={setFollowService}>
                                                    <SelectTrigger className="w-full h-10 border-slate-200 text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                                        <SelectValue placeholder="Choose..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Service 1">Service 1</SelectItem>
                                                        <SelectItem value="Service 2">Service 2</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex-1 flex items-center gap-4 text-[13px]">
                                                <span className="text-[#059669] font-medium w-20 shrink-0 dark:text-zinc-400">Method * :</span>
                                                <Select value={followMethod} onValueChange={setFollowMethod}>
                                                    <SelectTrigger className="w-full h-10 border-slate-200 text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                                        <SelectValue placeholder="Choose..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Method 1">Method 1</SelectItem>
                                                        <SelectItem value="Method 2">Method 2</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Reservation */}
                                        <div className="flex items-center gap-4 text-[13px] pt-2">
                                            <span className="text-[#059669] font-medium w-24 dark:text-zinc-400">Reservation * :</span>
                                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                                {['Mobile', 'On-Site Appointment', 'E-mail', 'Vm Appointment', 'Fax', 'No Need'].map(r => (
                                                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="reservation" 
                                                            className="accent-[#059669]"
                                                            checked={followReservation === r}
                                                            onChange={() => setFollowReservation(r)}
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
                                            >
                                                Submit
                                            </Button>
                                        </div>

                                        <hr className="my-6 border-slate-100 dark:border-zinc-800" />

                                        {/* Create Appointment Section */}
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-600 mb-4 dark:text-zinc-300">Create Appointment</h3>
                                            
                                            <div className="flex gap-4 items-end mb-8">
                                                <div className="flex-1">
                                                    <label className="block text-[12px] text-slate-600 mb-1 dark:text-zinc-300">Name</label>
                                                    <Select value={apptName} onValueChange={setApptName}>
                                                        <SelectTrigger className="w-full h-10 border-slate-200 text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                                            <SelectValue placeholder="Search Company Through Id/Name" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Company A">Company A</SelectItem>
                                                            <SelectItem value="Company B">Company B</SelectItem>
                                                        </SelectContent>
                                                    </Select>
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
                                                >
                                                    Create
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
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Manager</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Com</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Time</TableHead>
                                                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Action</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {inProcessAppointments.length > 0 ? (
                                                                    inProcessAppointments.map(appt => (
                                                                        <TableRow key={appt.id} className="border-b border-slate-100 dark:border-zinc-800">
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.company}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.meetingBy}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.manager}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.com}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.time}</TableCell>
                                                                            <TableCell className="text-[12px] text-slate-500 font-medium py-2 dark:text-zinc-400">{appt.action}</TableCell>
                                                                        </TableRow>
                                                                    ))
                                                                ) : (
                                                                    <TableRow className="border-b-0">
                                                                        <TableCell colSpan={6} className="h-10 text-center"></TableCell>
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
                                                                <TableRow className="border-b-0">
                                                                    <TableCell colSpan={5} className="h-10 text-center"></TableCell>
                                                                </TableRow>
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
                        <Select defaultValue="ld">
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
                            <Select defaultValue="10">
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
                            <Input type="text" className="h-8 w-[150px] border-slate-200 dark:border-zinc-800" />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-100 mb-4 dark:border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-zinc-800">
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">ID</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Company</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Account</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Email</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Phone</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Grade</TableHead>
                                    <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Create</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell colSpan={7} className="text-center py-4 text-[13px] text-slate-500 dark:text-zinc-400">No data available in table</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    
                    <div className="flex justify-between items-center text-[13px] text-slate-500 dark:text-zinc-400">
                        <span>Showing 0 to 0 of 0 entries</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-8 text-[12px] px-3" disabled>Previous</Button>
                            <Button variant="outline" size="sm" className="h-8 text-[12px] px-3" disabled>Next</Button>
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
                                <TableHead className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">ID</TableHead>
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
                            {customerMonthlyFilter === 'gm' ? (
                                <TableRow className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell>
                                        <input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" />
                                    </TableCell>
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">PKZAFA216133</TableCell>
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">ZAFAR</TableCell>
                                    {visibleColumns.Account && <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">bilal</TableCell>}
                                    {visibleColumns.Email && <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">zafar@excelstech.com</TableCell>}
                                    {visibleColumns.Phone && <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400"></TableCell>}
                                    {visibleColumns.NTN && <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">555</TableCell>}
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">3630345698741</TableCell>
                                    {visibleColumns.Grade && <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">C+</TableCell>}
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400"></TableCell>
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">2026-04-17 20:47:05</TableCell>
                                    <TableCell className="text-[12px] text-slate-500 font-medium dark:text-zinc-400">2026-04-17 20:45:44</TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
