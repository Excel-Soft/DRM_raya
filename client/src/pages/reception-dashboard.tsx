import { useState, useRef } from "react";
import { isSupportModuleEnabled } from "@/lib/feature-flags";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
    Users, Target, ArrowRightLeft, ChevronRight, PlusCircle, ChevronLeft, ChevronDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// Removing static mock data and using dynamic queries

export default function ReceptionDashboard() {
    const { toast } = useToast();
    const [activeMeetingTab, setActiveMeetingTab] = useState("in-process");
    const [meetingSearch, setMeetingSearch] = useState("");
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [meetingFile, setMeetingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedCompany, setSelectedCompany] = useState<string>("");
    const [selectedPerson, setSelectedPerson] = useState<string>("");
    const [selectedService, setSelectedService] = useState<string>("");
    const [clientFilter, setClientFilter] = useState("expected");

    const [topSellingFilter, setTopSellingFilter] = useState<string>("ld");
    const [expectedClientFilter, setExpectedClientFilter] = useState<string>("expected");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setMeetingFile(e.target.files[0]);
        }
    };

    const handleSaveMeetingFile = () => {
        if (!meetingFile) {
            toast({
                title: "Error",
                description: "Please select a file to attach to the meeting.",
                variant: "destructive"
            });
            return;
        }
        toast({
            title: "Success",
            description: "Meeting document securely uploaded."
        });
        setMeetingFile(null);
        setIsMeetingModalOpen(false);
    };

    const handleModalClose = (open: boolean) => {
        setIsMeetingModalOpen(open);
        if (!open) setMeetingFile(null);
    };

    const queryClient = useQueryClient();

    const { data: statsData } = useQuery({
        queryKey: ['/api/reception/stats', topSellingFilter],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/reception/stats?period=${topSellingFilter}`);
            return await res.json();
        }
    });
    
    // Default stats map
    const stats: any = statsData || {
        totalClients: 0,
        totalMeetings: 0,
        expectedClients: 0,
        interviewClients: 0,
        noticesCount: 0,
        complaintsCount: 0,
        eventCount: 0,
        loginTime: "00:00"
    };

    const { data: meetingsData } = useQuery({
        queryKey: ['/api/reception/meetings'],
    });

    const { data: customersData } = useQuery({
        queryKey: ['/api/customers?pageSize=1000'],
    });

    const { data: usersData } = useQuery({
        queryKey: ['/api/users'],
    });

    const { data: rolesData } = useQuery({
        queryKey: ['/api/settings/roles'],
    });

    const meetingsList = (meetingsData as any)?.data || [];
    
    // Format helpers
    const formatTime = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };
    
    const formatDate = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + formatTime(isoString);
    };
    
    const formatDuration = (seconds: number) => {
        if (!seconds) return "-";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m}:${s}`;
    };

    const expectedClients = meetingsList
        .filter((m: any) => m.status === 'expected')
        .map((m: any, idx: number) => ({
        ...m, no: idx + 1, company: m.companyName || m.personName || "UNKNOWN", meeting: m.personName, time: formatTime(m.meetingDate), date: formatDate(m.meetingDate)
    }));
    const inProcessClients = meetingsList.filter((m: any) => m.status === 'in_progress').map((m: any, idx: number) => ({
        ...m, no: idx + 1, company: m.companyName || m.personName || "UNKNOWN", service: m.meetingType, meeting: m.personName, time: formatTime(m.startTime)
    }));
    const endClients = meetingsList.filter((m: any) => m.status === 'ended').map((m: any, idx: number) => ({
        ...m, no: idx + 1, company: m.companyName || m.personName || "UNKNOWN", service: m.meetingType, meeting: m.personName, start: formatTime(m.startTime), end: formatTime(m.endTime), total: formatDuration(m.totalDurationSeconds)
    }));

    const filteredEndClients = endClients.filter((row: any) => {
        if (!meetingSearch) return true;
        const q = meetingSearch.toLowerCase();
        return (row.company || "").toLowerCase().includes(q) ||
               (row.service || "").toLowerCase().includes(q) ||
               (row.meeting || "").toLowerCase().includes(q);
    });
    
    const visitedClients = meetingsList.filter((m: any) => m.status === 'in_progress' || m.status === 'ended').map((m: any, idx: number) => ({
        ...m, no: idx + 1, company: m.companyName || m.personName || "UNKNOWN", meeting: m.personName, time: formatTime(m.startTime || m.meetingDate), date: formatDate(m.startTime || m.meetingDate)
    }));

    const displayExpectedClients = expectedClientFilter === "expected" ? expectedClients : visitedClients;

    const startMeetingMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("PATCH", `/api/reception/meetings/${id}/start`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/reception/meetings'] });
            toast({ title: "Status Updated", description: `Meeting moved to In Process.` });
        }
    });

    const endMeetingMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("PATCH", `/api/reception/meetings/${id}/end`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/reception/meetings'] });
            toast({ title: "Meeting Ended", description: `Meeting has ended.` });
        }
    });

    const createMeetingMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", "/api/reception/meetings", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/reception/meetings'] });
            toast({ title: "Meeting Created", description: `Meeting added to the Expected Client list.` });
            setSelectedCompany("");
            setSelectedPerson("");
            setSelectedService("");
        }
    });

    const moveToInProcess = (client: any) => {
        startMeetingMutation.mutate(client.id);
        setActiveMeetingTab('in-process');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const moveToEnd = (client: any) => {
        endMeetingMutation.mutate(client.id);
        setActiveMeetingTab('end');
    };

    const handleCreateMeeting = () => {
        if (!selectedCompany || !selectedPerson || !selectedService) {
            toast({ title: "Error", description: "Please completely fill the form to create a meeting.", variant: "destructive" });
            return;
        }

        createMeetingMutation.mutate({
            personName: selectedCompany !== "" ? `${selectedCompany} - ${selectedPerson}` : selectedPerson,
            meetingType: selectedService,
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
            {/* Header */}
            <div className="mb-6 flex items-center gap-1.5 text-[15px] font-bold tracking-tight px-2">
                <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">RECEPTION DEPARTMENT</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-2">
                {/* Left Column (Span 2) */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Top Selling Card */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-5 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Top Selling</h2>
                            <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                                <SelectTrigger className="w-[70px] h-8 text-[12px] font-medium border-slate-200 focus:ring-0 text-slate-600 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ld">LD</SelectItem>
                                    <SelectItem value="wc">WC</SelectItem>
                                    <SelectItem value="mc">MC</SelectItem>
                                    <SelectItem value="qc">QC</SelectItem>
                                    <SelectItem value="yc">YC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Stat 1 */}
                            <div className="bg-white border text-center border-slate-100 rounded-lg p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative pr-16 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Total Clients</p>
                                    <p className="text-[22px] font-bold text-slate-800 text-left dark:text-zinc-100">{stats.totalClients}</p>
                                </div>
                                <div className="h-10 w-10 absolute right-4 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm">
                                    <Users className="h-5 w-5" />
                                </div>
                            </div>

                            {/* Stat 2 */}
                            <div className="bg-white border text-center border-slate-100 rounded-lg p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative pr-16 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Meeting</p>
                                    <p className="text-[22px] font-bold text-slate-800 text-left dark:text-zinc-100">{stats.totalMeetings}</p>
                                </div>
                                <div className="h-10 w-10 absolute right-4 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm">
                                    <ArrowRightLeft className="h-5 w-5" />
                                </div>
                            </div>

                            {/* Stat 3 (Expected/Interview split) */}
                            <div className="bg-white border border-slate-100 rounded-lg p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative flex items-start gap-4 justify-between dark:bg-zinc-900 dark:border-zinc-800">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Expected</p>
                                    <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats.expectedClients}</p>
                                </div>
                                <div className="border-l border-slate-100 pl-4 dark:border-zinc-800">
                                    <p className="text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Interview</p>
                                    <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats.interviewClients}</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-[#059669] flex items-center justify-center text-white shadow-sm ml-auto mt-2 shrink-0">
                                    <Target className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meeting Detail Card */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-[15px] font-bold text-slate-700 w-1/3 dark:text-zinc-400">Meeting Detail</h2>
                            <div className="flex gap-6 justify-center w-1/3">
                                <button
                                    onClick={() => setActiveMeetingTab('in-process')}
                                    className={`text-[13px] font-bold px-8 py-2 rounded transition-colors ${activeMeetingTab === 'in-process' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
                                >
                                    In Process
                                </button>
                                <button
                                    onClick={() => setActiveMeetingTab('end')}
                                    className={`text-[13px] font-bold px-8 py-2 rounded transition-colors ${activeMeetingTab === 'end' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
                                >
                                    End
                                </button>
                            </div>
                            <div className="w-1/3"></div>
                        </div>

                        {activeMeetingTab === 'in-process' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-b border-white">
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 rounded-tl dark:text-zinc-300">No#</th>
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Company</th>
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Service</th>
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Meeting</th>
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Time</th>
                                            <th className="py-3 px-4 text-[13px] font-bold text-slate-600 rounded-tr w-16 dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inProcessClients.map((row: any, idx: number) => (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors dark:border-zinc-800">
                                                <td className="py-4 px-4 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{idx + 1}</td>
                                                <td className="py-4 px-4 text-[13px] font-semibold text-slate-600 uppercase dark:text-zinc-300">{row.company}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.service}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{row.meeting}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.time}</td>
                                                <td className="py-4 px-4">
                                                    <button onClick={() => moveToEnd(row)} className="h-6 w-8 bg-[#ef4444] rounded flex flex-col items-center justify-center hover:bg-[#dc2626] transition-colors relative overflow-hidden group dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                                        <ChevronRight className="h-5 w-5 text-white stroke-[3] group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                                        <div className="flex flex-col">
                                            <span>Show</span>
                                            <Select defaultValue="10">
                                                <SelectTrigger className="w-[65px] h-8 text-[12px]"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="10">10</SelectItem></SelectContent>
                                            </Select>
                                            <span>entries</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[13px] text-slate-600 self-end mb-5 dark:text-zinc-300">
                                        <div className="flex flex-col items-end gap-1">
                                            <span>Search:</span>
                                            <input type="text" value={meetingSearch} onChange={(e) => setMeetingSearch(e.target.value)} className="h-8 w-[180px] text-[13px] border border-slate-200 rounded px-2 outline-none focus:border-[#059669] dark:border-zinc-800" />
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto mt-[-10px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-b border-white">
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 rounded-tl dark:text-zinc-300">No#</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Company</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Service</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Meeting</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Start</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">End</th>
                                                <th className="py-3 px-4 text-[13px] font-bold text-slate-600 rounded-tr dark:text-zinc-300">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEndClients.map((row: any, idx: number) => (
                                                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors dark:border-zinc-800">
                                                    <td className="py-4 px-4 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{idx + 1}</td>
                                                    <td className="py-4 px-4 text-[13px] font-semibold text-slate-600 uppercase dark:text-zinc-300">{row.company}</td>
                                                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.service}</td>
                                                    <td className="py-4 px-4 text-[13px] font-medium text-slate-600 dark:text-zinc-300">{row.meeting}</td>
                                                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.start}</td>
                                                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.end}</td>
                                                    <td className="py-4 px-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400">{row.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daily Expected Client Card */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-6 pt-2 border-t border-slate-100 mt-[-10px] dark:border-zinc-800">
                            <h2 className="text-[15px] font-bold text-slate-700 mt-2 dark:text-zinc-400">
                                {expectedClientFilter === 'expected' ? 'Daily Expected Client' : 'Event Attendance'}
                            </h2>
                            <Select value={expectedClientFilter} onValueChange={setExpectedClientFilter}>
                                <SelectTrigger className="w-[160px] h-9 text-[13px] font-semibold border-slate-200 focus:ring-0 text-slate-600 mt-2 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expected">Expected Client</SelectItem>
                                    <SelectItem value="event">Event Attendance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-zinc-800">
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">No#</th>
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Company</th>
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Meeting</th>
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Time</th>
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 dark:text-zinc-300">Last Contact</th>
                                        <th className="py-3 px-4 text-[13px] font-bold text-slate-600 text-center dark:text-zinc-300">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayExpectedClients.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-500 text-[13px]">
                                                No {expectedClientFilter} clients found.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayExpectedClients.map((row: any, idx: number) => (
                                            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <td className="py-4 px-4 text-[13px] font-bold text-slate-700 dark:text-zinc-400">{idx + 1}</td>
                                                <td className="py-4 px-4 text-[13px] font-bold text-slate-600 uppercase dark:text-zinc-300">{row.company}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-600 w-[140px] dark:text-zinc-300">{row.meeting}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-500 w-[90px] dark:text-zinc-400">{row.time}</td>
                                                <td className="py-4 px-4 text-[13px] font-medium text-slate-500 w-[160px] dark:text-zinc-400">{row.date}</td>
                                                <td className="py-4 px-4 w-16 text-center">
                                                    <button onClick={() => moveToInProcess(row)} className="mx-auto h-6 w-8 bg-transparent flex flex-col items-center justify-center group">
                                                        <ChevronRight className="h-6 w-6 text-emerald-600 stroke-[3] group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column (Span 1) */}
                <div className="space-y-6">

                    {/* Promotion Baners */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-5 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Promotion Baners</h3>
                        <div className="block w-full rounded overflow-hidden relative group cursor-pointer aspect-[3/1] bg-[#fca5a5] dark:bg-zinc-900">
                            {/* Minimalistic plant image mock */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#fca5a5] to-[#fecaca] opacity-80" />
                            <div className="absolute inset-0 flex justify-center items-end pb-0">
                                <svg viewBox="0 0 100 100" className="w-[80%] h-[150%] text-[#453c30] -mb-10 opacity-70 dark:text-zinc-400" preserveAspectRatio="none">
                                    <path d="M50 100 Q 40 50 10 20 Q 50 70 50 100" fill="currentColor" />
                                    <path d="M50 100 Q 60 40 90 20 Q 50 60 50 100" fill="currentColor" />
                                    <path d="M50 100 L 50 10 L 55 100" fill="currentColor" />
                                    <path d="M50 100 Q 30 50 20 10 Q 45 70 48 100" fill="currentColor" />
                                    <path d="M50 100 Q 70 30 80 5 Q 55 50 52 100" fill="currentColor" />
                                </svg>
                            </div>

                            {/* Left Arrow Overlay */}
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
                                <ChevronLeft className="h-8 w-8 stroke-[1.5]" />
                            </div>
                            {/* Right Arrow Overlay */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
                                <ChevronRight className="h-8 w-8 stroke-[1.5]" />
                            </div>
                        </div>
                    </div>

                    {/* Projects Overview */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-5 mt-[-2px] dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[15px] font-bold text-[#1e3a5f] mb-4 dark:text-zinc-100">Projects Overview</h3>
                        <div className="grid grid-cols-2 gap-3 gap-y-2">
                            {[
                                { name: 'Notice Board', link: '/notice-board' },
                                { name: 'DRM Policies', link: '/policies' },
                                { name: 'Over Time', link: '/hr/overtime' },
                                { name: 'Leave Application', link: '/hr/leave-request' },
                                { name: 'Attendance', link: '/hr/attendance' },
                                ...(isSupportModuleEnabled() ? [{ name: 'Support Tickets', link: '/support/tickets' }] : []),
                            ].map((item, idx) => (
                                <Link key={idx} href={item.link}>
                                    <a className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border border-slate-100 px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors rounded-[2px] block w-full hover:no-underline dark:border-zinc-800 dark:hover:bg-zinc-800">
                                        <span className="text-[13px] font-medium text-[#1e6199] truncate dark:text-zinc-100">{item.name}</span>
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 stroke-[2] shrink-0" />
                                    </a>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Create Meeting Card */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-5 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-4 dark:border-zinc-800">
                            <h3 className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Create Meeting</h3>
                            <PlusCircle onClick={() => setIsMeetingModalOpen(true)} className="h-5 w-5 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 cursor-pointer hover:scale-110 transition-transform" />
                        </div>

                        <div className="space-y-4 mb-6">
                            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                                <SelectTrigger className="w-full h-10 text-[13px] text-slate-500 border-slate-200 bg-white shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Search Company Through Id/Name" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {(customersData as any)?.customers?.map((c: any) => (
                                        <SelectItem key={c.id} value={c.companyName || c.accountName || c.id}>
                                            {c.companyName || c.accountName || c.id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                                <SelectTrigger className="w-full h-10 text-[13px] text-slate-500 border-slate-200 bg-white shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Select Role / Department" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {(rolesData as any)?.map((r: any) => {
                                        const displayName = r.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                                        return (
                                            <SelectItem key={r.id} value={displayName}>
                                                {displayName}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-3 mb-6">
                            {[
                                'New Sell', 'Renewal', 'Inform', 'Designing',
                                'Development', 'Posting', 'Training', 'Project Overview',
                                'Domain Registration', 'Seminar', 'Webinar', 'Photoshoots',
                                'Outdoor', 'Digital marketing', 'Service'
                            ].map((option, idx) => (
                                <label key={idx} onClick={() => setSelectedService(option)} className="flex items-center gap-1.5 cursor-pointer group col-span-1">
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${selectedService === option ? 'border-[#059669]' : 'border-slate-300 bg-white dark:bg-zinc-900 group-hover:border-[#059669]'}`}>
                                        {selectedService === option && (
                                            <div className="w-[6px] h-[6px] rounded-full bg-[#059669] shrink-0" />
                                        )}
                                    </div>
                                    <span className="text-[12px] font-medium text-[#1e3a5f] font-sans tracking-tight leading-tight line-clamp-1 group-hover:text-slate-800 dark:text-zinc-100">{option}</span>
                                </label>
                            ))}
                        </div>

                        <button onClick={handleCreateMeeting} type="button" className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-7 py-2 rounded transition-colors shadow-none mt-2">
                            Add
                        </button>
                    </div>

                    {/* Important Info section matches screenshot placement under 'Add' button */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 p-5 mt-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-800 mb-4 dark:text-zinc-100">Important</h3>
                        <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 rounded-md overflow-hidden grid grid-cols-2 divide-x divide-slate-100 shadow-[inset_0_0_2px_rgba(0,0,0,0.05)] text-slate-600 dark:text-zinc-300">
                            <div className="flex justify-between px-3 py-2.5 bg-slate-100/50">
                                <span className="text-[12px] font-bold">Notice</span>
                                <span className="text-[12px] font-medium italic select-all">{stats.noticesCount}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2.5 bg-slate-100/50">
                                <span className="text-[12px] font-bold">Complaints</span>
                                <span className="text-[12px] font-medium italic select-all">{stats.complaintsCount}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2.5">
                                <span className="text-[12px] font-bold">Event</span>
                                <span className="text-[12px] font-medium italic select-all">{stats.eventCount}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2.5">
                                <span className="text-[12px] font-bold">Login Time</span>
                                <span className="text-[12px] font-medium italic select-all">{stats.loginTime}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Meeting Modal */}
            <Dialog open={isMeetingModalOpen} onOpenChange={handleModalClose}>
                <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white border-0 gap-0 dark:bg-zinc-900">
                    <DialogHeader className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-bold text-slate-600 tracking-tight dark:text-zinc-300">Add Meeting</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pb-8">
                        <label className="text-[14px] font-bold text-slate-600 block mb-2 dark:text-zinc-300">Company</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="flex w-full items-center border border-[#059669] rounded-[4px] cursor-pointer overflow-hidden transition-colors dark:border-zinc-800"
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="bg-[#f1f5f9] px-4 py-2 border-r border-slate-200 text-[13px] text-slate-600 font-medium hover:bg-slate-200 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                Choose file
                            </div>
                            <div className="px-3 py-2 text-[13px] text-slate-500 font-medium flex-1 bg-white truncate dark:bg-zinc-900 dark:text-zinc-400">
                                {meetingFile ? meetingFile.name : "No file chosen"}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white sm:justify-end flex gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogClose asChild>
                            <button type="button" className="px-5 py-2 min-w-[80px] bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 hover:bg-slate-100 text-[#0f172a] text-[14px] font-bold rounded-[4px] transition-colors shadow-sm dark:hover:bg-zinc-800 dark:text-zinc-400">
                                Close
                            </button>
                        </DialogClose>
                        <button type="button" className="px-5 py-2 min-w-[80px] bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[4px] transition-colors shadow-sm" onClick={handleSaveMeetingFile}>
                            Save
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
