import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users, Repeat, Tag, Target, Clock, Wallet, CheckCircle, ChevronRight, Activity, Building2, Briefcase, ChevronLeft, Plug, User, Eye, UserPlus, FileText, CloudDownload, Search, Pencil
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

export default function ItManagerDashboard() {
    const [, setLocation] = useLocation();
    const [activeDomainTab, setActiveDomainTab] = useState("3-month");
    const [activeView, setActiveView] = useState("dashboard");
    const [activeHistoryTab, setActiveHistoryTab] = useState("contact");
    const [whatsappMsg, setWhatsappMsg] = useState("");
    const [gmDocOpen, setGmDocOpen] = useState(false);
    const [gmBvSubmitOpen, setGmBvSubmitOpen] = useState(false);
    const [domainBackupModalOpen, setDomainBackupModalOpen] = useState(false);
    const [showAdditional, setShowAdditional] = useState(false);
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [selectedActionRow, setSelectedActionRow] = useState<{ name: string, task: string } | null>(null);
    const [leaveAppDialogOpen, setLeaveAppDialogOpen] = useState(false);
    const [selectedLeaveRow, setSelectedLeaveRow] = useState<{ no: number, name: string } | null>(null);
    const [renewDomainOpen, setRenewDomainOpen] = useState(false);
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [activeQuarter, setActiveQuarter] = useState("q4");
    const [followupOpen, setFollowupOpen] = useState(false);
    const activitiesData = [
        // Using minor value for complete just so it's visible or handle 0 properly
        { name: 'Complete', value: 0, color: '#f1f5f9' },
        { name: 'Pending', value: 374, color: '#34d399' },
        { name: 'Delay', value: 307, color: '#64748b' },
        { name: 'Free', value: 323, color: '#1e293b' }
    ];

    // Domain data (mocked from image)
    const domainDetailsData = [
        { id: 1, company: "RAKT RAJ INDUSTRIES", domain: "Ezzydc.com", day: -3, expire: "27/03/2026" },
        { id: 2, company: "QASIM SONS COMPANY", domain: "Qasimsonscompany.com", day: -4, expire: "26/03/2026" },
        { id: 3, company: "VIVOVOX INDUSTRY", domain: "Vivovoxindustry.com", day: -17, expire: "13/03/2026" },
        { id: 4, company: "Shikra International", domain: "Parianimpex.com", day: -19, expire: "11/03/2026" },
        { id: 5, company: "RAKT RAJ INDUSTRIES", domain: "eazzydc.com", day: -24, expire: "06/03/2026" },
        { id: 6, company: "RAKT RAJ INDUSTRIES", domain: "raktraj.com", day: -24, expire: "06/03/2026" },
        { id: 7, company: "RIPPLE APPAREL INTERNATIONAL", domain: "Rippleapparelintl.com", day: -30, expire: "28/02/2026" },
    ];

    const threeMonthExpireData = [
        { id: 1, company: "HAS J INDUSTRY", domain: "modestolz.at", day: 13, expire: "12/04/2026" },
        { id: 2, company: "UNI STAR", domain: "unistarint.co.uk", day: 14, expire: "13/04/2026" },
        { id: 3, company: "Shikra International", domain: "excelsdigital.com", day: 85, expire: "23/06/2026" },
        { id: 4, company: "MALIKWAL INTERNATIONAL", domain: "malikwalinternational.com", day: 83, expire: "21/06/2026" },
        { id: 5, company: "YOULONG GLOVES", domain: "youlonggloves.com", day: 73, expire: "11/06/2026" },
        { id: 6, company: "RAFA FORKLIFT", domain: "Rafaforklift.com", day: 72, expire: "10/06/2026" },
        { id: 7, company: "KASSIM TEXTILE", domain: "Kassimtextile.com", day: 72, expire: "10/06/2026" },
        { id: 8, company: "Crescent Instruments", domain: "atak-i.com", day: 75, expire: "13/06/2026" }
    ];

    const displayedDomains = activeDomainTab === "3-month" ? threeMonthExpireData : domainDetailsData;

    if (activeView === "leave-application") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                </div>

                <div className="mb-6 px-2">
                    <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 uppercase tracking-tight">PENDING LEAVE / <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">FORMS</span></h2>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden dark:bg-zinc-900">
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex flex-col gap-1.5 align-start">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                <div className="flex items-center gap-2">
                                    <Select defaultValue="10">
                                        <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                            </div>
                            <div className="flex flex-col gap-1 align-start self-end">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 pl-4 text-left dark:text-zinc-400">No</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Purpose</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Type</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Alternative</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Monthly Leaves</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Monthly Half Leaves</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Day</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Time</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Start</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">End</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Create</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[
                                        { no: 258, name: 'Shakeel Sikandar', purpose: 'Urgent Work', type: 'Half', alt: 'Sana e Mustafa', detail: 'Urgent Work', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '02-08-2025', create: '04-08-2025 10:08:AM' },
                                        { no: 428, name: 'Shakeel Sikandar', purpose: 'Urgent Work', type: 'Half', alt: '', detail: 'Urgent Work', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '14-04-2025', create: '14-04-2025 10:04:AM' },
                                        { no: 680, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Half', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '07-12-2024', create: '10-12-2024 10:12:AM' },
                                        { no: 848, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Half', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '04-09-2024', create: '04-09-2024 01:09:PM' },
                                        { no: 884, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Full', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '1', day: '1', time: '', start: '01-01-1970', end: '15-08-2024', create: '16-08-2024 09:08:AM' },
                                    ].map((row, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">{row.no}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.name}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.purpose}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.type}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.alt}</TableCell>
                                            <TableCell className="text-[13px] font-medium py-4">
                                                <span className={row.detail === 'Urgent Work' ? 'bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold' : 'text-slate-600 dark:text-slate-300'}>{row.detail}</span>
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.monthly}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.monthlyHalf}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.day}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.time}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.start}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.end}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums whitespace-nowrap dark:text-zinc-300">{row.create}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div
                                                    className="h-6 w-6 rounded-full border-[1.5px] border-[#059669] flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800"
                                                    onClick={() => { setSelectedLeaveRow({ no: row.no, name: row.name }); setLeaveAppDialogOpen(true); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                            <span className="text-[13.5px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Showing 1 to 5 of 5 entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Application Modal */}
                <Dialog open={leaveAppDialogOpen} onOpenChange={setLeaveAppDialogOpen}>
                    <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
                            <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold tracking-tight">Application</h3>
                            <button onClick={() => setLeaveAppDialogOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Name</label>
                                <Input
                                    disabled
                                    value={selectedLeaveRow?.name || 'Shakeel Sikandar'}
                                    className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Alibaba</label>
                                <Select defaultValue="choose">
                                    <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
                                            <Input placeholder="" className="h-8 border-slate-200 text-[13px] dark:border-zinc-800" />
                                        </div>
                                        <div className="py-1">
                                            <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Alibaba</div>
                                            <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                            <SelectItem value="approved" className="text-white font-bold bg-[#059669] focus:bg-[#059669] focus:text-white data-[highlighted]:bg-[#059669] data-[highlighted]:text-white">Approved</SelectItem>
                                            <SelectItem value="cancel" className="text-slate-700 font-medium dark:text-zinc-400">Cancel</SelectItem>
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 dark:border-zinc-800">
                            <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setLeaveAppDialogOpen(false)}>
                                Close
                            </button>
                            <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors" onClick={() => setLeaveAppDialogOpen(false)}>
                                Save
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    if (activeView === "overtime") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden dark:bg-zinc-900">
                    <div className="py-4 px-6 border-b border-slate-50 dark:border-zinc-800">
                        <h2 className="text-[15px] font-bold text-[#475569] uppercase dark:text-zinc-400">OVERTIME</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Show</span>
                                <Select defaultValue="10">
                                    <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">entries</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 pl-4 w-12 dark:text-zinc-400">#</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Name</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Task</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Time</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Task Detail</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Manager</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Create</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-center pr-4 dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">1</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Sana e Mustafa</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Account Office</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">70</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300"></TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Pending</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">2025-10-02 12:10:PM</TableCell>
                                        <TableCell className="py-4 text-center pr-4">
                                            <div
                                                className="flex justify-center flex-col items-center cursor-pointer"
                                                onClick={() => {
                                                    setSelectedActionRow({ name: "Sana e Mustafa", task: "Account Office" });
                                                    setActionDialogOpen(true);
                                                }}
                                            >
                                                <Plug className="h-4 w-4 text-slate-500 hover:text-slate-800 transition-colors dark:text-zinc-400" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">2</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Sana e Mustafa</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Accounts office</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">47</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300"></TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Pending</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">2025-10-02 12:10:PM</TableCell>
                                        <TableCell className="py-4 text-center pr-4">
                                            <div
                                                className="flex justify-center flex-col items-center cursor-pointer"
                                                onClick={() => {
                                                    setSelectedActionRow({ name: "Sana e Mustafa", task: "Accounts office" });
                                                    setActionDialogOpen(true);
                                                }}
                                            >
                                                <Plug className="h-4 w-4 text-slate-500 hover:text-slate-800 transition-colors dark:text-zinc-400" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-4">
                            <span className="text-[13px] text-slate-500 font-medium dark:text-zinc-400">Showing 1 to 2 of 2 entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>

                        {/* Overtime Action Dialog */}
                        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader className="border-b border-slate-50 pb-4 dark:border-zinc-800">
                                    <DialogTitle className="text-[16px] font-bold text-slate-600 dark:text-zinc-300">Overtime</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Name</label>
                                        <Input disabled value={selectedActionRow?.name || "Sana e Mustafa"} className="bg-slate-50/50 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Task</label>
                                        <Input disabled value={selectedActionRow?.task || "Account Office"} className="bg-slate-50/50 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Status</label>
                                        <Select defaultValue="choose">
                                            <SelectTrigger className="text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800">
                                                <SelectValue placeholder="Choose..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="choose">Choose...</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-end gap-2 pt-2 border-t border-slate-50 dark:border-zinc-800">
                                    <DialogClose asChild>
                                        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-bold rounded transition-colors dark:bg-zinc-900 dark:text-zinc-400">
                                            Close
                                        </button>
                                    </DialogClose>
                                    <button className="px-4 py-2 bg-[#52b788] hover:bg-[#40916c] text-white text-[13px] font-bold rounded transition-colors" onClick={() => setActionDialogOpen(false)}>
                                        Save
                                    </button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-backup") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                {/* Header Navbar */}
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden text-slate-700 dark:bg-zinc-900 dark:text-zinc-400">
                    <div className="py-4 px-6 border-b border-slate-50 flex items-center justify-between dark:border-zinc-800">
                        <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">DOMAIN BACKUP</h2>
                    </div>

                    <div className="p-6">
                        <button onClick={() => setDomainBackupModalOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors mb-6 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/50">
                            Add New Backup
                        </button>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex flex-col gap-1.5 align-start">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                <div className="flex items-center gap-2">
                                    <Select defaultValue="10">
                                        <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                            </div>

                            <div className="flex flex-col gap-1 align-start self-end">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 pl-4 w-12 text-left dark:text-zinc-400">No#</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Person</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Domain</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Web Type</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Url</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Day</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">01</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Afaq Ali</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Urgent Work</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Full</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Tuseef Abbas</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">For Exams</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 whitespace-nowrap dark:text-zinc-300">26-05-2023 11:00 AM</TableCell>
                                        <TableCell className="py-4 text-center items-center justify-center flex">
                                            <button className="text-white bg-[#ef4444]/90 hover:bg-[#ef4444] rounded flex items-center justify-center h-6 w-6 transition flex-shrink-0 shadow-sm outline-none mx-auto dark:hover:bg-zinc-800">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                            <span className="text-[13.5px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Showing 1 to 1 of 1 entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>

                        {/* Add Leave / Backup Modal */}
                        <Dialog open={domainBackupModalOpen} onOpenChange={setDomainBackupModalOpen}>
                            <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white dark:bg-zinc-900">
                                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between m-0 dark:border-zinc-800">
                                    <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold m-0 p-0 tracking-tight">Add Leave</DialogTitle>
                                    <DialogClose className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer absolute right-4 top-4 dark:hover:bg-zinc-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        <span className="sr-only">Close</span>
                                    </DialogClose>
                                </DialogHeader>

                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Domain:</label>
                                            <Input placeholder="Domian name" className="h-10 border-slate-200 text-[#475569] placeholder:text-[#94a3b8] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Web Type:</label>
                                            <Select defaultValue="choose">
                                                <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                                    <SelectValue placeholder="Choose..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                                    <SelectItem value="full" className="text-slate-700 font-medium dark:text-zinc-400">Full</SelectItem>
                                                    <SelectItem value="partial" className="text-slate-700 font-medium dark:text-zinc-400">Partial</SelectItem>
                                                    <SelectItem value="none" className="text-slate-700 font-medium dark:text-zinc-400">None</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Server Url:</label>
                                        <Input placeholder="Day" className="h-10 border-slate-200 text-[#475569] placeholder:text-[#94a3b8] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Detail:</label>
                                        <textarea className="w-full min-h-[90px] p-3 text-[14px] border border-slate-200 rounded-md outline-none focus:border-[#059669]/50 focus:ring-1 focus:ring-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20/50 dark:border-zinc-800">
                                    <DialogClose asChild>
                                        <button className="px-5 py-2.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e293b] text-[14px] font-bold rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100">
                                            Close
                                        </button>
                                    </DialogClose>
                                    <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#059669]/50" onClick={() => setDomainBackupModalOpen(false)}>
                                        Save
                                    </button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-report") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">DOMAIN REPORT</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pb-8 dark:bg-zinc-900">
                        <h2 className="text-[15px] font-bold text-[#475569] uppercase mb-6 dark:text-zinc-400">DOMAIN REPORT COMPARE CUSTOMER</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Start</label>
                                <div className="relative">
                                    <Input type="date" className="h-[42px] border-slate-200 text-slate-500 bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" placeholder="yyyy-m-d" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Start</label>
                                <div className="relative">
                                    <Input type="date" className="h-[42px] border-slate-200 text-slate-500 bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" placeholder="yyyy-m-d" />
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="h-[450px] w-full bg-slate-50/30 rounded border border-slate-100 flex items-center justify-center dark:border-zinc-800">
                            <span className="text-slate-400 text-[13px] font-medium">Chart Area</span>
                        </div>
                    </div>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[16px] font-bold text-slate-600 mb-8 dark:text-zinc-300">In Service Customer</h3>

                        <div className="flex border-b border-slate-100 dark:border-zinc-800">
                            {[
                                { id: 'q1', label: 'Q1 Apr-Jun', count: 217 },
                                { id: 'q2', label: 'Q2 Jul-Sep', count: 267 },
                                { id: 'q3', label: 'Q3 Oct-Dec', count: 281 },
                                { id: 'q4', label: 'Q4 Jan-Mar', count: 253 },
                            ].map((q) => {
                                const isActive = activeQuarter === q.id;
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => setActiveQuarter(q.id)}
                                        className={cn(
                                            "flex-1 text-center pb-4 cursor-pointer transition-all duration-200",
                                            isActive
                                                ? "border-b-[3px] border-[#059669] relative top-[2px]"
                                                : "group"
                                        )}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <span className={cn(
                                                "text-[13px] font-bold transition-colors",
                                                isActive
                                                    ? "bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"
                                                    : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:text-slate-200"
                                            )}>
                                                {q.label}
                                            </span>
                                            <span className={cn(
                                                "text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors",
                                                isActive
                                                    ? "bg-[#059669]/10 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"
                                                    : "bg-slate-100 text-slate-500 dark:text-slate-400"
                                            )}>
                                                {q.count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-detail") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-list")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Domain List
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">ATTRIBUTE</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-[#475569] font-bold text-[16px] px-2 uppercase mb-[-12px] dark:text-zinc-400">ATTRIBUTE</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Card: Spedster Sports */}
                        <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 flex flex-col items-center dark:bg-zinc-900">
                            <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">Spedster Sports</h3>
                            <div className="h-12 w-12 rounded-full bg-[#e0e7ff] text-[#4f46e5] flex items-center justify-center text-[16px] font-bold mb-5 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">D</div>
                            <p className="text-[14px] font-bold text-slate-700 mb-0.5 dark:text-zinc-400">Muhammad Khawaja ( CEO )</p>
                            <p className="text-[12px] font-semibold text-slate-400 mb-4 hover:text-slate-600 transition-colors cursor-pointer tracking-tight">spedstersports@yahoo.com</p>

                            <div className="flex gap-2 mb-6">
                                <span className="bg-[#059669] text-white text-[12px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#047857] transition-colors cursor-pointer">0523256399</span>
                                <span className="bg-[#059669] text-white text-[12px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#047857] transition-colors cursor-pointer">03016263980</span>
                            </div>

                            <div className="grid grid-cols-2 w-full gap-4 mb-6 pt-4 border-t border-slate-50/50 dark:border-zinc-800">
                                <div className="text-center flex flex-col items-center border-r border-slate-50 dark:border-zinc-800">
                                    <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Grade:</p>
                                    <div className="h-10 w-10 rounded-full bg-[#fef08a]/60 text-[#ca8a04] flex items-center justify-center text-[14px] font-bold shadow-sm">D</div>
                                </div>
                                <div className="text-center flex flex-col items-center">
                                    <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Contact:</p>
                                    <div className="h-10 w-10 rounded-full bg-[#fecaca]/50 text-[#dc2626] flex items-center justify-center text-[14px] font-bold shadow-sm">0</div>
                                </div>
                            </div>

                            <div className="text-center mb-8 w-full">
                                <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Last Contact:</p>
                                <span className="bg-[#334155] text-white text-[12px] font-bold px-4 py-1.5 rounded shadow-sm">01-01-1970 05:00 AM</span>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 mt-auto">
                                <button onClick={() => setFollowupOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Followup</button>
                                <button onClick={() => setActiveView("domain-quotation")} className="bg-[#64748b] hover:bg-[#475569] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Quotation</button>
                                <button onClick={() => setActiveView("domain-invoice")} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Invoice</button>
                                <button onClick={() => setGmDocOpen(true)} className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors mt-0.5 dark:bg-zinc-900 dark:hover:bg-zinc-800">Gm Doc</button>
                                <button onClick={() => setGmBvSubmitOpen(true)} className="bg-[#eab308] hover:bg-[#ca8a04] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors mt-0.5 border border-[#ca8a04]/20 dark:border-zinc-800 dark:bg-zinc-900">Gm BV submit</button>
                            </div>
                        </div>

                        {/* Center Card: Expiry Date */}
                        <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pb-2 dark:bg-zinc-900">
                            <h3 className="text-[15px] font-bold text-slate-700 mb-8 dark:text-zinc-400">Expiry Date</h3>

                            <div className="relative pl-7 space-y-10 before:absolute before:inset-0 before:ml-[34px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-slate-100">
                                {/* Domain Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserPlus className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Domain</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">spedstersports.com</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date 07-08-2022</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">Day Left 966</span>
                                        </div>
                                    </div>
                                </div>
                                {/* SSL Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Ssl</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">spedstersports.com</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date 07-08-2022</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">Day Left 966</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Hosting Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CloudDownload className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Hosting</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">spedstersports.com</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date 07-08-2022</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">Day Left 966</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Area: Whatsapp & Duplicate */}
                        <div className="space-y-6">
                            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 dark:bg-zinc-900">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">Whatsapp Message</h3>
                                <div className="space-y-3">
                                    <p className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Message:</p>
                                    <textarea
                                        value={whatsappMsg}
                                        onChange={(e) => setWhatsappMsg(e.target.value)}
                                        className="w-full min-h-[90px] p-2 text-[13px] border border-slate-200 rounded outline-none focus:border-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm dark:text-zinc-300 dark:border-zinc-800"
                                    />
                                    <button
                                        onClick={() => window.open(`https://wa.me/923016263980?text=${encodeURIComponent(whatsappMsg)}`, '_blank')}
                                        className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors mt-2"
                                    >
                                        Whatsapp
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 dark:bg-zinc-900">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">Duplicate Company Details</h3>
                                <button onClick={() => alert("Duplicate search initialized.")} className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors flex items-center gap-2 w-max">
                                    <Search className="h-4 w-4" /> Find Duplicate Companies
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Area: History */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 mt-6 dark:bg-zinc-900">
                        <h2 className="text-[#475569] font-bold text-[15px] mb-6 dark:text-zinc-400">History</h2>

                        <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto no-scrollbar justify-start dark:border-zinc-800">
                            {[
                                { id: 'contact', title: 'Contact History' },
                                { id: 'company', title: 'Company History' },
                                { id: 'quotation', title: 'Quotation History' },
                                { id: 'invoice', title: 'Invoice History' },
                                { id: 'templates', title: 'Quotation Templates' },
                            ].map((tab) => (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveHistoryTab(tab.id)}
                                    className={cn(
                                        "pb-3 md:pb-4 whitespace-nowrap px-1 cursor-pointer transition-colors relative top-[2px]",
                                        activeHistoryTab === tab.id
                                            ? "border-b-2 border-slate-400"
                                            : "group"
                                    )}
                                >
                                    <span className={cn(
                                        "text-[13px] transition-colors",
                                        activeHistoryTab === tab.id
                                            ? "font-bold text-slate-600 dark:text-slate-300"
                                            : "font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:text-slate-200"
                                    )}>
                                        {tab.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            {activeHistoryTab === "contact" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left pl-6 w-[15%] dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[20%] dark:text-zinc-400">CM</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[15%] dark:text-zinc-400">Next CD</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[20%] dark:text-zinc-400">Next CM</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Note</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-[13px] font-medium">No history data available.</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "company" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Title</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Actin By</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { title: "Move From Duplication", detail: "Spedster Sports, Move From Saim Tariq To Saim Tariq", by: "Maria Rani", date: "26-03-2026 02:24 PM" },
                                            { title: "Move From Duplication", detail: "Spedster Sports, Move From Muhammad Nadeem Zulfiqar To Saim Tariq", by: "Maria Rani", date: "26-03-2026 02:22 PM" },
                                            { title: "Create", detail: "Spedster Sports is Created", by: "Muhammad Nadeem Zulfiqar", date: "18-03-2021 03:58 PM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.title}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.detail}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "quotation" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sub Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Discount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Pay First</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Send By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { date: "29-08-2025 11:16 AM", sub: "18", discount: "0", total: "20", payFirst: "100", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "29-08-2025 09:23 AM", sub: "18", discount: "0", total: "19", payFirst: "33", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "01-07-2025 03:18 PM", sub: "120", discount: "4000", total: "105.92", payFirst: "0", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "10-06-2025 04:45 PM", sub: "63", discount: "7800", total: "35.44", payFirst: "0", by: "Muhammad Nadeem Zulfiqar" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.date}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.sub}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.discount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.total}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.payFirst}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "invoice" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Company Name</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sale Person</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total Amount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">View</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "14000", date: "28-02-2024 12:20 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "21000", date: "12-01-2024 12:30 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "18000", date: "22-12-2022 02:18 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "18000", date: "12-12-2022 10:24 AM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.company}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.amount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <div onClick={() => setActiveView("domain-invoice")} className="h-6 w-6 rounded-full border border-[#059669]/20 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors dark:border-zinc-800">
                                                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "templates" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Title</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sub Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Discount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Pay First</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Make By</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { title: "Domain Registration", sub: "18", discount: "0", total: "20", payFirst: "100", by: "Muhammad Nadeem Zulfiqar", date: "29-08-2025 11:16 AM" },
                                            { title: "Domain Registration", sub: "18", discount: "0", total: "19", payFirst: "33", by: "Muhammad Nadeem Zulfiqar", date: "29-08-2025 09:23 AM" },
                                            { title: "Domain Registration & Hosting Plan & SSL Certificate &", sub: "132", discount: "9964", total: "88.11", payFirst: "0", by: "Muhammad Nadeem Zulfiqar", date: "19-11-2022 02:50 PM" },
                                            { title: "Domain Registration &", sub: "15", discount: "0", total: "15", payFirst: "0", by: "Namriza", date: "19-06-2021 03:17 PM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 truncate max-w-[280px] dark:text-zinc-300">{row.title}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.sub}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.discount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.total}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.payFirst}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <div onClick={() => setActiveView("domain-quotation")} className="h-6 w-6 rounded-full border border-[#059669]/20 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors dark:border-zinc-800">
                                                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>

                    {/* GM Doc Dialog */}
                    <Dialog open={gmDocOpen} onOpenChange={setGmDocOpen}>
                        <DialogContent className="sm:max-w-[480px] p-8 bg-white border-none shadow-xl dark:bg-zinc-900">
                            <DialogHeader className="mb-4">
                                <DialogTitle className="text-[#3b4b6b] text-[18px] font-bold dark:text-zinc-100">GM Doc</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Packge</label>
                                    <Input className="h-10 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Status</label>
                                    <Input className="h-10 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">GM Date</label>
                                    <Input type="date" className="h-10 border-slate-200 text-slate-500 block w-full bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Note</label>
                                    <textarea className="w-full min-h-[90px] p-3 text-[13px] border border-slate-200 rounded-md outline-none focus:border-[#059669]/50 focus:ring-1 focus:ring-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm dark:text-zinc-300 dark:border-zinc-800" />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[13.5px] font-semibold text-[#475569] mb-4 tracking-tight dark:text-zinc-400">Please check the Relevant Doc which is submitted in GM BV</p>
                                    <div className="space-y-2.5">
                                        {[
                                            "NTN",
                                            "Latest 181 Form",
                                            "ID card",
                                            "Bank Statement",
                                            "Phone bill",
                                            "Deed (If company have partner)"
                                        ].map((doc, index) => (
                                            <label key={index} className="flex items-center gap-3 cursor-pointer group w-fit">
                                                <input type="checkbox" className="w-4 h-4 border-slate-300 rounded bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] cursor-pointer dark:border-zinc-800" />
                                                <span className="text-[13.5px] font-medium text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300">{doc}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Followup Dialog */}
                    <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
                        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[96vh] overflow-y-auto p-0 border border-slate-200 shadow-2xl rounded-xl overflow-hidden gap-0 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            {/* Header */}
                            <div className="flex bg-white items-center justify-between px-6 py-4 border-b border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <DialogTitle className="text-[#64748b] text-[18px] font-bold tracking-tight">Follow The Customer</DialogTitle>
                                <DialogClose className="rounded-full p-1.5 hover:bg-slate-100 transition-colors dark:hover:bg-zinc-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    <span className="sr-only">Close</span>
                                </DialogClose>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-white space-y-4 dark:bg-zinc-900">
                                <Input disabled value="Spedster Sports" className="h-10 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-slate-200 text-[#475569] font-medium dark:text-zinc-400 dark:border-zinc-800" />

                                <div className="border border-slate-200 rounded p-5 pb-6 dark:border-zinc-800">
                                    <p className="text-[13px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 mb-4">Select Services:<span className="text-[#ef4444]">*</span></p>
                                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                                        {[
                                            "Alibaba Membership",
                                            "Alibaba Services",
                                            "Design Development",
                                            "Domain Hosting"
                                        ].map((service, index) => (
                                            <label key={index} className="flex items-center gap-2.5 cursor-pointer group">
                                                <input type="checkbox" className="w-4 h-4 border-slate-300 rounded bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] cursor-pointer dark:border-zinc-800" />
                                                <span className="text-[13.5px] font-bold text-[#64748b] group-hover:text-[#475569] transition-colors">{service}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {showAdditional && (
                                    <Select defaultValue="Select Reservation">
                                        <SelectTrigger className="h-10 border-slate-200 text-[#64748b] font-medium focus:ring-[#059669] dark:border-zinc-800">
                                            <SelectValue placeholder="Select Reservation" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Select Reservation" className="text-slate-500 font-medium dark:text-zinc-400">Select Reservation</SelectItem>
                                            <SelectItem value="Mobile" className="font-medium text-[#64748b]">Mobile</SelectItem>
                                            <SelectItem value="WhatsApp" className="font-medium text-[#64748b]">WhatsApp</SelectItem>
                                            <SelectItem value="WH-Call" className="font-medium text-[#64748b]">WH-Call</SelectItem>
                                            <SelectItem value="In-meeting" className="font-medium text-[#64748b]">In-meeting</SelectItem>
                                            <SelectItem value="Out-meeting" className="font-medium text-[#64748b]">Out-meeting</SelectItem>
                                            <SelectItem value="E-mail" className="font-medium text-[#64748b]">E-mail</SelectItem>
                                            <SelectItem value="On-Site Appointment" className="font-medium text-[#64748b]">On-Site Appointment</SelectItem>
                                            <SelectItem value="Vm Appointment" className="font-medium text-[#64748b]">Vm Appointment</SelectItem>
                                            <SelectItem value="Fax" className="font-medium text-[#64748b]">Fax</SelectItem>
                                            <SelectItem value="No Need" className="font-medium text-[#64748b]">No Need</SelectItem>
                                            <SelectItem value="Seminar" className="font-medium text-[#64748b]">Seminar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}

                                <button
                                    onClick={() => setShowAdditional(!showAdditional)}
                                    className={`w-full py-2 rounded text-[13.5px] font-bold border transition-colors flex items-center justify-center gap-2 ${showAdditional
                                        ? "border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/5"
                                        : "border-[#059669] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 hover:bg-[#059669]/5"
                                        }`}
                                >
                                    {showAdditional ? (
                                        <>
                                            <div className="w-3.5 h-3.5 rounded-full bg-[#ef4444] flex items-center justify-center text-white pb-[1px] leading-none text-[10px] font-black dark:bg-zinc-900">-</div>
                                            Hide Additional Details
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-3.5 h-3.5 rounded-full bg-[#059669] flex items-center justify-center text-white pb-[1px] leading-none text-[10px] font-black">+</div>
                                            Show Additional Details
                                        </>
                                    )}
                                </button>

                                <button className="w-full bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold py-2.5 rounded transition-colors mt-2">
                                    Submit
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* GM BV Submit Dialog */}
                    <Dialog open={gmBvSubmitOpen} onOpenChange={setGmBvSubmitOpen}>
                        <DialogContent className="sm:max-w-[420px] p-8 bg-white border-none shadow-xl dark:bg-zinc-900">
                            <DialogHeader className="mb-2">
                                <DialogTitle className="text-[#3b4b6b] text-[18px] font-bold dark:text-zinc-100">User GM BV Submit Date</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Packge</label>
                                    <Input className="h-10 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Status</label>
                                    <Input className="h-10 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">User GM BV Submit Date</label>
                                    <Input type="date" className="h-10 border-slate-200 text-slate-500 block w-full bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                </div>
            </div>
        );
    }

    if (activeView === "domain-list") {
        const listData = [
            { no: 3, company: 'Spedster Sports', domainName: 'spedstersports.com', dom1: '07-08-2023', dom2: '07-08-2022', host1: '07-08-2023', host2: '07-08-2022', ssl1: '07-08-2023', ssl2: '07-08-2022', register: '2010-12-14' },
            { no: 3, company: 'Spedster Sports', domainName: 'spedstersports.com', dom1: '07-08-2023', dom2: '07-08-2022', host1: '07-08-2023', host2: '07-08-2022', ssl1: '07-08-2023', ssl2: '07-08-2022', register: '2010-12-14' },
            { no: 3, company: 'Spedster Sports', domainName: 'spedstersports.com', dom1: '07-08-2023', dom2: '07-08-2022', host1: '07-08-2023', host2: '07-08-2022', ssl1: '07-08-2023', ssl2: '07-08-2022', register: '2010-12-14' },
            { no: 4, company: 'Khatamu Nabiyeen', domainName: 'dent-home.com', dom1: '12-03-2025', dom2: '12-03-2024', host1: '28-01-2022', host2: '28-01-2021', ssl1: '12-03-2025', ssl2: '12-03-2024', register: '2021-03-12' },
        ];

        const handleExport = (type: "copy" | "csv" | "excel" | "pdf" | "print") => {
            if (type === "print" || type === "pdf") {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    const html = `
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <title>DRM Dashboard Print</title>
                                <style>
                                    @page { size: portrait; margin: 15mm; }
                                    body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; color: #333; }
                                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: middle; }
                                    th { font-weight: bold; color: #111; font-size: 10px; }
                                    td { color: #444; }
                                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
                                    .header-left h1 { margin: 0; font-size: 22px; color: #111; font-weight: 500; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                                    .header-right { font-size: 10px; font-weight: 600; color: #111; padding-bottom: 2px; }
                                    .header-date { font-size: 10px; color: #666; margin-bottom: 8px; }
                                </style>
                            </head>
                            <body>
                                <div class="header-date">${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</div>
                                <div class="header">
                                    <div class="header-left">
                                        <h1>DRM Dashboard</h1>
                                    </div>
                                    <div class="header-right">
                                        DRM Dashboard
                                    </div>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width: 30px;">No</th>
                                            <th>Company Name</th>
                                            <th>Domain Name</th>
                                            <th>Domain</th>
                                            <th>Hosting</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${listData.map(item => `
                                            <tr>
                                                <td>${item.no}</td>
                                                <td>${item.company}</td>
                                                <td>${item.domainName}</td>
                                                <td>${item.dom1}${item.dom2}</td>
                                                <td>${item.host1}${item.host2}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <script>
                                    window.onload = function() {
                                        setTimeout(function() {
                                            window.print();
                                        }, 150);
                                    }
                                </script>
                            </body>
                        </html>
                    `;
                    printWindow.document.open();
                    printWindow.document.write(html);
                    printWindow.document.close();
                }
                return;
            }

            const headers = ["No", "Company Name", "Domain Name", "Domain 1", "Domain 2", "Hosting 1", "Hosting 2", "SSL 1", "SSL 2", "Register Date"];
            const rows = listData.map(item => [
                item.no, item.company, item.domainName, item.dom1, item.dom2, item.host1, item.host2, item.ssl1, item.ssl2, item.register
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(e => e.join(","))
            ].join("\n");

            if (type === "copy") {
                navigator.clipboard.writeText(csvContent);
                alert("Table data copied to clipboard!");
            } else if (type === "csv" || type === "excel") {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `Domain_List_Export.${type}`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">DOMAIN LIST</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-[#475569] font-bold text-[16px] px-2 mb-[-12px] dark:text-zinc-400">IT DEPARTMENT</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Company Name</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter company name" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Person Name</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter person name" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Contact No#</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter contact no" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Email</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter e-mail" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">NTN/CINC #</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter NTN/CINC" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">AB ID</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter AB ID No" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Team (Company)</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter Company name" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Team Member</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter team member name" />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-[#475569] font-bold text-[16px] px-2 mt-8 mb-[-12px] uppercase dark:text-zinc-400">Domain / Hosting / SSL</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                            <div className="flex bg-[#64748b] rounded overflow-hidden shadow-sm">
                                <button onClick={() => handleExport('copy')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition">Copy</button>
                                <button onClick={() => handleExport('excel')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Excel</button>
                                <button onClick={() => handleExport('csv')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">CSV</button>
                                <button onClick={() => handleExport('pdf')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">PDF</button>
                                <button onClick={() => handleExport('print')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Print</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-44 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 pl-4 w-12 text-left dark:text-zinc-400">No</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Company Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Domain Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Domain</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Hosting</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">SSL</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Register</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center pr-4 dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {listData.map((row, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">{row.no}</TableCell>
                                            <TableCell className="text-[13px] font-bold text-[#475569] py-4 whitespace-nowrap dark:text-zinc-400">{row.company}</TableCell>
                                            <TableCell className="text-[13px] py-4 whitespace-nowrap">
                                                <span className="bg-[#a7f3d0]/60 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-2 py-0.5 rounded font-bold">{row.domainName}</span>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.dom1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.dom2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.host1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.host2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.ssl1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.ssl2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[12px] font-bold text-slate-500 py-4 text-center dark:text-zinc-400">{row.register}</TableCell>
                                            <TableCell className="py-4 pr-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => setActiveView("domain-detail")} className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors">
                                                        <User className="h-4 w-4 text-white" />
                                                    </button>
                                                    <button onClick={() => setActiveView("domain-quotation")} title="Quotation" className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors">
                                                        <Eye className="h-4 w-4 text-white" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-quotation") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-list")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Domain List
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">INVOICE QUOTATION</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-slate-600 font-bold text-[16px] px-2 mb-[-12px] uppercase dark:text-zinc-300">
                        Invoice Qoutation <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold">30-03-2026 09:12 PM</span>
                    </h2>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 md:p-8 dark:bg-zinc-900">
                        {/* Top Info Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Account Holder</label>
                                <Input disabled value="Muhammad Khawaja" className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Company</label>
                                <Input disabled value="Spedster Sports" className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Email</label>
                                <Input disabled value="spedstersports@yahoo.com" className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Contact</label>
                                <Input disabled value="0523256399" className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                        </div>

                        {/* Product Table Area */}
                        <div className="overflow-x-auto pb-4 mb-6">
                            <div className="min-w-[1000px]">
                                {/* Table Headers */}
                                <div className="grid grid-cols-[100px_minmax(150px,2fr)_80px_80px_100px_80px_100px_100px_100px_minmax(150px,2fr)_80px] gap-3 mb-2 px-1">
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Product <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Detail <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Min Time <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Max Time <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Unit Price <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Quantity <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Total</div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Start Year</div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">End Year <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Domain URL <span className="text-red-500">*</span></div>
                                    <div className="text-[12px] font-bold text-slate-600 text-center dark:text-zinc-300">Action</div>
                                </div>
                                {/* Table Row */}
                                <div className="grid grid-cols-[100px_minmax(150px,2fr)_80px_80px_100px_80px_100px_100px_100px_minmax(150px,2fr)_80px] gap-3 mb-4 items-center">
                                    <Select>
                                        <SelectTrigger className="h-9 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
                                    </Select>
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                    <Select>
                                        <SelectTrigger className="h-9 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select Year" /></SelectTrigger>
                                        <SelectContent><SelectItem value="2025">2025</SelectItem></SelectContent>
                                    </Select>
                                    <Select>
                                        <SelectTrigger className="h-9 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select Ye..." /></SelectTrigger>
                                        <SelectContent><SelectItem value="2026">2026</SelectItem></SelectContent>
                                    </Select>
                                    <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter domain" />
                                    <button className="h-8 bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold rounded shadow-sm transition-colors mx-1 dark:bg-zinc-900 dark:hover:bg-zinc-800">Delete</button>
                                </div>
                            </div>
                            <button className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors mt-2">Add Row</button>
                        </div>

                        {/* Bottom Grid Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 gap-y-6 pt-4 border-t border-slate-100 mb-8 dark:border-zinc-800">
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Sub Amount <span className="text-red-500">*</span></label>
                                <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Delivery Time <span className="text-red-500">*</span></label>
                                <div className="flex items-center gap-2">
                                    <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                                    <span className="text-slate-400 font-bold">---</span>
                                    <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">GST % <span className="text-red-500">*</span></label>
                                <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Payment Term % <span className="text-red-500">*</span></label>
                                <Select>
                                    <SelectTrigger className="h-10 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent><SelectItem value="100">100%</SelectItem></SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Total Amount <span className="text-red-500">*</span></label>
                                <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Amount <span className="text-red-500">*</span></label>
                                <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Pkr Discount <span className="text-red-500">*</span></label>
                                <div className="flex items-center gap-4 h-10">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="rounded border-slate-300 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] dark:border-zinc-800" />
                                        <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300">In Percentage</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="rounded border-slate-300 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] dark:border-zinc-800" />
                                        <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300">In Amount</span>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">$Grand Total <span className="text-red-500">*</span></label>
                                <Input className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Pkr Total</label>
                                <Input className="h-10 border-slate-200 bg-slate-50/50 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Save <span className="text-red-500">*</span></label>
                                <Select>
                                    <SelectTrigger className="h-10 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent><SelectItem value="y">Yes</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Note</label>
                                <textarea className="w-full h-10 min-h-[40px] p-2 text-[13px] border border-slate-200 rounded outline-none focus:border-[#059669]/50 transition-colors resize-none dark:border-zinc-800" />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-6 py-2.5 rounded shadow-sm transition-colors">Save Change</button>
                            <button className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-6 py-2.5 rounded shadow-sm transition-colors">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-invoice") {
        return (
            <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-detail")} className="text-slate-400 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to History
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">INVOICE PREVIEW</span>
                    </div>
                </div>

                <div className="max-w-[800px] mx-auto bg-white shadow-md p-8 pt-12 mt-6 dark:bg-zinc-900">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            {/* Logo representation */}
                            <div className="flex items-center gap-3">
                                <div className="h-14 w-14 rounded-full border-[3px] border-[#34d399] flex items-center justify-center relative overflow-hidden bg-white shadow-sm shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    {/* Using CSS to mimic the intersecting circles and cursive W from screenshot */}
                                    <div className="absolute -left-1 -top-1 w-10 h-10 border-[2px] border-[#34d399] rounded-full opacity-60 dark:border-zinc-800"></div>
                                    <div className="absolute right-0 bottom-0 w-8 h-8 border-[2px] border-[#34d399] rounded-full opacity-60 dark:border-zinc-800"></div>
                                    <span className="text-[#22c55e] font-black text-3xl italic tracking-tighter mix-blend-multiply relative z-10 mr-1 mt-1 font-serif dark:text-zinc-100">W</span>
                                </div>
                                <div className="mt-1">
                                    <h1 className="text-[26px] font-black text-[#22c55e] tracking-tighter italic leading-none dark:text-zinc-100" style={{ textShadow: "1px 1px 0px #000" }}>WEB EXCELS</h1>
                                    <p className="text-[10px] italic font-semibold text-slate-800 tracking-tight mt-0.5 dark:text-zinc-100" style={{ fontFamily: "cursive" }}>Design, Development & Marketing</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right pt-2 space-y-1">
                            <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100"><span className="text-slate-800 dark:text-zinc-100">Invoice No:</span>2856</p>
                            <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100"><span className="text-slate-800 dark:text-zinc-100">Date:</span>2024-02-28 12:20:47</p>
                        </div>
                    </div>

                    {/* Green Banner */}
                    <div className="flex items-center justify-center bg-[#4ade80] text-white h-10 mb-8 relative">
                        {/* We use a white background block in the middle to house the black text as in the screenshot */}
                        <div className="bg-white px-6 h-full flex items-center justify-center z-10 w-fit shrink-0 dark:bg-zinc-900">
                            <h2 className="text-[28px] font-black text-black uppercase tracking-widest leading-none pt-1">INVOICE</h2>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-2 gap-8 mb-8 pb-4">
                        <div className="text-[10px] leading-relaxed text-black/90">
                            <p className="font-bold mb-1">From:</p>
                            <p>Web Excels</p>
                            <p>+92-334-8086611 (Whatsapp)</p>
                            <p>+92-52-4271592</p>
                            <p className="mt-2 text-[#0ea5e9] dark:text-zinc-400">Support@Webexcels.com</p>
                            <p className="mt-2">Al-Amin Center, Paris Rd, Opposite The</p>
                            <p>Sialkot Chamber Of Commerce, Sialkot</p>
                            <p>51310 Pakistan.</p>
                        </div>
                        <div className="text-[10px] leading-relaxed text-black/90 pr-12">
                            <p className="font-bold mb-1">To:</p>
                            <p>Titan Un</p>
                            <p>Phone:0523256399</p>
                            <p className="mt-2">Email:<span className="text-[#0ea5e9] dark:text-zinc-400">spedstersports@yahoo.com</span></p>
                            <p className="mt-2">Address:mullah Muhammad Pura Ugoki</p>
                            <p>Sialkot</p>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left mb-6 border-collapse border border-slate-700 dark:border-zinc-800">
                        <thead>
                            <tr className="bg-[#2a3042] text-white">
                                <th className="py-2.5 px-3 text-[11px] font-bold w-10 border border-slate-700 text-center dark:border-zinc-800">Sl.</th>
                                <th className="py-2.5 px-3 text-[11px] font-bold border border-slate-700 text-center dark:border-zinc-800">Item Description</th>
                                <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Price</th>
                                <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Quantity</th>
                                <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Total</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px] text-black">
                            <tr>
                                <td className="py-3 px-3 border border-slate-700 font-bold text-center dark:border-zinc-800">1</td>
                                <td className="py-3 px-3 border border-slate-700 dark:border-zinc-800">
                                    <span className="font-bold block text-[11px] text-black mb-1">Domain Registration</span>
                                    <span className="text-black">(Titanun.com) For 1 Year (01/02/2024) To (10/02/2025)</span>
                                </td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">$18</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">1</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">18</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-3 border border-slate-700 font-bold text-center dark:border-zinc-800">2</td>
                                <td className="py-3 px-3 border border-slate-700 dark:border-zinc-800">
                                    <span className="font-bold block text-[11px] text-black mb-1">Hosting Plan</span>
                                    <span className="text-black">Hosting (250Mb) For 1 Year (01/02/2024) To (10/02/2025)</span>
                                </td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">$15</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">1</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">15</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-3 border border-slate-700 font-bold text-center dark:border-zinc-800">3</td>
                                <td className="py-3 px-3 border border-slate-700 dark:border-zinc-800">
                                    <span className="font-bold block text-[11px] text-black mb-1">Ssl Certificate</span>
                                    <span className="text-black">Ssl Certificate</span>
                                </td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">$20</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">1</td>
                                <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">20</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Totals Box */}
                    <div className="flex justify-end mb-16 pt-2">
                        <div className="w-[280px] text-[12px] font-extrabold text-[#0f172a] space-y-2.5 dark:text-zinc-400">
                            <div className="flex justify-between pl-4">
                                <span>Sub Total:</span>
                                <span>$53</span>
                            </div>
                            <div className="flex justify-between pl-4">
                                <span>Sub Total:</span>
                                <span>14787 Pkr</span>
                            </div>
                            <div className="flex justify-between pl-4">
                                <span>Discount:</span>
                                <span className="text-[#333]">787 Pkr</span>
                            </div>
                            <div className="flex justify-between bg-[#22c55e] text-white py-2.5 px-4 shadow-sm mt-1">
                                <span>Total:</span>
                                <span>14000 Pkr</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t-4 border-[#34d399] pt-2 text-center text-[10px] font-bold text-black pb-8 dark:border-zinc-800">
                        This Invoice Only For Titan Un . Copyright 2026 Reserved By Webexcels.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans">
            {/* Breadcrumb Header */}
            <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                    <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="text-slate-500 uppercase dark:text-zinc-400">IT MANAGER</span>
                </div>
            </div>

            {/* Top Selling & Promotion */}
            <div className="grid grid-cols-12 gap-6 mb-6">
                {/* Top Selling (8 Cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Top Selling</h2>
                        <Select defaultValue="ld">
                            <SelectTrigger className="w-24 h-8 bg-white text-[13px] font-medium border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ld">LD</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Domain */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Total Domain</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">1176</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Expire */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Expire</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Repeat className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Expired */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Expired</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">517</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Tag className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Due */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Due</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Target className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Promotion Banners (4 Cols) */}
                <div className="col-span-12 lg:col-span-4">
                    <h2 className="text-[16px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Promotion Baners</h2>
                    <Card className="overflow-hidden border-none shadow-sm rounded-[10px] relative h-[90px] group">
                        <img
                            src="https://img.freepik.com/free-photo/young-women-hugging-each-other-smiling_23-2148181676.jpg"
                            alt="Promotion Banner"
                            className="w-full h-full object-cover"
                        />
                        {/* Chevrons overlay */}
                        <div className="absolute inset-0 flex items-center justify-between px-2 bg-gradient-to-t from-black/10 to-transparent">
                            <div className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="rotate-180" /></div>
                            <div className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight /></div>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Domain Details (8 columns) */}
                <div className="col-span-12 lg:col-span-8">
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-3 px-6 border-b border-slate-50 flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Domain Details</CardTitle>
                            <div className="flex flex-wrap items-center gap-4 border border-slate-100 rounded bg-slate-50 p-1 dark:bg-zinc-900 dark:border-zinc-800">
                                <button
                                    onClick={() => setActiveDomainTab("3-month")}
                                    className={cn(
                                        "px-5 py-1.5 text-[13px] font-bold rounded transition-all",
                                        activeDomainTab === "3-month" ? "bg-[#059669] text-white shadow-sm hover:bg-[#047857]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                    )}
                                >
                                    3-Month Expire Domains
                                </button>
                                <button
                                    onClick={() => setActiveDomainTab("expired")}
                                    className={cn(
                                        "px-5 py-1.5 text-[13px] font-bold rounded transition-all",
                                        activeDomainTab === "expired" ? "bg-[#059669] text-white shadow-sm hover:bg-[#047857]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                    )}
                                >
                                    Expired Domains
                                </button>
                            </div>
                        </CardHeader>

                        <div className="overflow-x-auto min-h-[300px]">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 pl-6 w-16 dark:text-zinc-300">No#</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 dark:text-zinc-300">Company</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 dark:text-zinc-300">Domain</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center dark:text-zinc-300">Day</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center dark:text-zinc-300">Expire</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center pr-6 dark:text-zinc-300">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedDomains.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50 border-slate-50 group dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-800 py-3 pl-6 dark:text-zinc-100">{row.id}</TableCell>
                                            <TableCell className="text-[13px] font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3 cursor-pointer hover:underline uppercase">{row.company}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.domain}</TableCell>
                                            <TableCell className="text-[12px] font-medium py-3 text-center">
                                                <span className="bg-slate-100/80 text-slate-500 px-2.5 py-1 rounded-full dark:text-zinc-400">{row.day}</span>
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-3 text-center tabular-nums dark:text-zinc-300">{row.expire}</TableCell>
                                            <TableCell className="py-3 text-center pr-6">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[120px] mx-auto">
                                                     <div onClick={() => setActiveView("domain-detail")} className="w-6 h-6 rounded-full bg-[#059669]/10 flex items-center justify-center text-[#059669] cursor-pointer hover:bg-[#059669]/20 transition-all shadow-sm dark:text-zinc-400" title="View Detail"><Eye className="w-3.5 h-3.5" /></div>
                                                     <div onClick={() => setFollowupOpen(true)} className="w-6 h-6 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] cursor-pointer hover:bg-[#3b82f6]/20 transition-all shadow-sm dark:text-zinc-100" title="Follow Up"><Clock className="w-3.5 h-3.5" /></div>
                                                     <div onClick={() => {}} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-200 transition-all shadow-sm dark:text-zinc-400 dark:bg-zinc-900" title="Edit Domain"><Pencil className="w-3.5 h-3.5" /></div>
                                                     <div onClick={() => {}} className="w-6 h-6 rounded-full bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] cursor-pointer hover:bg-[#f59e0b]/20 transition-all shadow-sm" title="Account Details"><User className="w-3.5 h-3.5" /></div>
                                                 </div>

                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                    {/* Monthly Invoices Box */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden mt-6 dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Monthly Invoices</CardTitle>
                            <Select defaultValue="invoice">
                                <SelectTrigger className="w-28 h-8 bg-white text-[13px] font-medium border-slate-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue placeholder="Invoice" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="invoice">Invoice</SelectItem>
                                    <SelectItem value="payment">Payment</SelectItem>
                                    <SelectItem value="due">Due</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>

                        <CardContent className="p-6 bg-white dark:bg-zinc-900">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex flex-col gap-1.5 align-start">
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                    <div className="flex items-center gap-2">
                                        <Select defaultValue="10">
                                            <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                                </div>
                                <div className="flex flex-col gap-1 align-start self-end">
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                    <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 pl-4 text-left w-12 dark:text-zinc-300">No</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Company</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Sale Person</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Create</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Payment</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-center pr-2 dark:text-zinc-300">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { no: 1, company: 'ENDOHOICE MEDICAL', sp: 'M.salman', create: '30/03/2026 17:55:01 PM', payment: '0', invoiceNo: '8062', toCompany: 'Endohoice Medical', phone: '03311343506', email: 'endochoice@Gmail.com', address: 'sialkot', items: [{ sl: 1, desc: 'Listing Page', price: '$62', qty: 1, total: '62' }], subTotal: '$62', subTotalPkr: '17360 Pkr', discount: '17360 Pkr', totalPkr: '0 Pkr' },
                                            { no: 2, company: 'ENDOHOICE MEDICAL', sp: 'M.salman', create: '30/03/2026 17:55:01 PM', payment: '0', invoiceNo: '8063', toCompany: 'Endohoice Medical', phone: '03311343506', email: 'endochoice@Gmail.com', address: 'sialkot', items: [{ sl: 1, desc: 'Logo Design', price: '$45', qty: 1, total: '45' }], subTotal: '$45', subTotalPkr: '12600 Pkr', discount: '12600 Pkr', totalPkr: '0 Pkr' },
                                            { no: 3, company: 'ENDOHOICE MEDICAL', sp: 'M.salman', create: '30/03/2026 17:55:01 PM', payment: '0', invoiceNo: '8064', toCompany: 'Endohoice Medical', phone: '03311343506', email: 'endochoice@Gmail.com', address: 'sialkot', items: [{ sl: 1, desc: 'SEO Package', price: '$80', qty: 1, total: '80' }], subTotal: '$80', subTotalPkr: '22400 Pkr', discount: '22400 Pkr', totalPkr: '0 Pkr' },
                                            { no: 4, company: 'KHATAMU NABIYEEN', sp: 'Muhammad Nadeem Zulfiqar', create: '30/03/2026 17:48:43 PM', payment: '9000', invoiceNo: '8065', toCompany: 'Khatamu Nabiyeen', phone: '03001234567', email: 'khatamu@gmail.com', address: 'Lahore', items: [{ sl: 1, desc: 'Web Development', price: '$120', qty: 1, total: '120' }], subTotal: '$120', subTotalPkr: '33600 Pkr', discount: '24600 Pkr', totalPkr: '9000 Pkr' },
                                            { no: 5, company: 'SPORTING SOLUTIONS GEAR', sp: 'Zill E Huma', create: '30/03/2026 17:34:16 PM', payment: '15000', invoiceNo: '8066', toCompany: 'Sporting Solutions Gear', phone: '03129876543', email: 'sporting@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'E-Commerce Store', price: '$150', qty: 1, total: '150' }], subTotal: '$150', subTotalPkr: '42000 Pkr', discount: '27000 Pkr', totalPkr: '15000 Pkr' },
                                            { no: 6, company: 'RAWLINE APPARELS', sp: 'Zill E Huma', create: '30/03/2026 17:29:26 PM', payment: '0', invoiceNo: '8067', toCompany: 'Rawline Apparels', phone: '03451234567', email: 'rawline@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'Social Media Marketing', price: '$55', qty: 1, total: '55' }], subTotal: '$55', subTotalPkr: '15400 Pkr', discount: '15400 Pkr', totalPkr: '0 Pkr' },
                                            { no: 7, company: 'RAWLINE APPARELS', sp: 'Zill E Huma', create: '30/03/2026 17:29:26 PM', payment: '0', invoiceNo: '8068', toCompany: 'Rawline Apparels', phone: '03451234567', email: 'rawline@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'Domain Registration', price: '$15', qty: 1, total: '15' }], subTotal: '$15', subTotalPkr: '4200 Pkr', discount: '4200 Pkr', totalPkr: '0 Pkr' },
                                            { no: 8, company: 'RAWLINE APPARELS', sp: 'Zill E Huma', create: '30/03/2026 17:29:26 PM', payment: '0', invoiceNo: '8069', toCompany: 'Rawline Apparels', phone: '03451234567', email: 'rawline@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'Hosting Package', price: '$30', qty: 1, total: '30' }], subTotal: '$30', subTotalPkr: '8400 Pkr', discount: '8400 Pkr', totalPkr: '0 Pkr' },
                                            { no: 9, company: 'TEPRA SPORTS', sp: 'Waqas Ahmed', create: '30/03/2026 17:27:13 PM', payment: '0', invoiceNo: '8070', toCompany: 'Tepra Sports', phone: '03567890123', email: 'tepra@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'Business Card Design', price: '$25', qty: 1, total: '25' }], subTotal: '$25', subTotalPkr: '7000 Pkr', discount: '7000 Pkr', totalPkr: '0 Pkr' },
                                            { no: 10, company: 'TEPRA SPORTS', sp: 'Waqas Ahmed', create: '30/03/2026 17:27:13 PM', payment: '0', invoiceNo: '8071', toCompany: 'Tepra Sports', phone: '03567890123', email: 'tepra@gmail.com', address: 'Sialkot', items: [{ sl: 1, desc: 'Banner Design', price: '$35', qty: 1, total: '35' }], subTotal: '$35', subTotalPkr: '9800 Pkr', discount: '9800 Pkr', totalPkr: '0 Pkr' },
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.no}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 uppercase dark:text-zinc-300">{row.company}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 dark:text-zinc-300">{row.sp}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 tabular-nums dark:text-zinc-300">{row.create}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 tabular-nums dark:text-zinc-300">{row.payment}</TableCell>
                                                <TableCell className="py-3.5 text-center items-center justify-center flex">
                                                    <div className="h-5 w-5 rounded-full border-[1.5px] border-[#059669]/60 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800" onClick={() => { setSelectedInvoice(row); setInvoiceDialogOpen(true); }}>
                                                        <Eye className="h-3 w-3 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                                <span className="text-[13.5px] text-slate-500 font-medium dark:text-zinc-400">Showing 1 to 10 of 880 entries</span>
                                <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                    <button className="px-3.5 py-1.5 bg-white text-slate-300 text-[13px] font-medium pointer-events-none transition-colors border-r border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">Previous</button>
                                    <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold">1</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">2</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">3</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">4</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">5</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">...</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">88</button>
                                    <button className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 focus:outline-none hover:text-slate-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">Next</button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Cards (4 columns) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Projects Overview */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Projects Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 gap-2">
                                <div
                                    onClick={() => setActiveView("overtime")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800">Over Time</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-report")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800">Domain Report</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-list")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800">Domain List</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-backup")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800">Domain Backup</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Important */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Important</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 text-[13px]">
                                {/* Total Hosting */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Total Hosting</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">279.67</span>
                                </div>
                                {/* Total Use */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Total Use</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">279.67</span>
                                </div>
                                {/* Server */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Server</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">279.67</span>
                                </div>
                                {/* Registry */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Registry</span>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold md:ml-2">139</span>
                                </div>
                                {/* Hosting Pkg */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Hosting Pkg</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">132</span>
                                </div>
                                {/* Pending */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Pending</span>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold md:ml-2">124</span>
                                </div>
                                {/* Leave Application */}
                                <div
                                    onClick={() => setActiveView("leave-application")}
                                    className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer group dark:hover:bg-zinc-800 dark:border-zinc-800"
                                >
                                    <span className="text-slate-500 font-medium group-hover:text-slate-700 dark:text-zinc-400">Leave Application</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">5</span>
                                </div>
                                {/* Dollar Rate */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Dollar Rate</span>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold md:ml-2">279.67</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activities */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Activities</CardTitle>
                            <Select defaultValue="td">
                                <SelectTrigger className="w-20 h-8 bg-white text-[13px] font-medium border-slate-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="td">TD</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-6 bg-white dark:bg-zinc-900">
                            {/* Pie Chart */}
                            <div className="h-[200px] w-full mb-6 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activitiesData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {activitiesData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-700 dark:text-zinc-400">
                                    <Activity className="h-6 w-6 text-slate-400 mb-1 opacity-50" />
                                </div>
                            </div>

                            {/* Progress Bars */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Total Project</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">139</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-[#10b981] w-full rounded-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Complete</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">0</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-200 w-0 rounded-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Pending</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">374</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-[#34d399] w-[70%] rounded-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Delay</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">307</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-50 w-[60%] rounded-full dark:bg-zinc-900"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Free</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">323</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-800 w-[65%] rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Expire Domains - Full Width */}
                <div className="col-span-12 mt-6">
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Expire Domains</CardTitle>
                            <Select defaultValue="1mh">
                                <SelectTrigger className="w-24 h-8 bg-white text-[13px] font-medium border-slate-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue placeholder="1 MH" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1mh">1 MH</SelectItem>
                                    <SelectItem value="3mh">3 MH</SelectItem>
                                    <SelectItem value="6mh">6 MH</SelectItem>
                                    <SelectItem value="12mh">12 MH</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-0 bg-white dark:bg-zinc-900">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[1400px]">
                                    <thead>
                                        <tr className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 border-b border-slate-100 dark:border-zinc-800">
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">No#</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Domain</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Type</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Day</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Register Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">First Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Expire Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">D/H$</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">T$</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">O$R</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">O/Pkr</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">N$R</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">N/Pkr</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Inv/Rep</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap text-center dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11px]">
                                        {[
                                            { no: '1/2828', domain: 'massgloves.com', type: 'domain', day: 2, regDate: '01/04/2015', firstDate: '01/04/2025', expDate: '01/04/2026', dh: '18/42$', t: '60$', osr: '239', opkr: '14340', nsr: '279.67', npkr: '16780.2', inv: 'invoice', invColor: 'bg-[#f97316]', inv2: 'Rec:4873 Rs:15000', hasAction: false },
                                            { no: '2/2523', domain: 'blazesportswears.com', type: 'domain', day: 5, regDate: '04/02/2022', firstDate: '04/04/2025', expDate: '04/04/2026', dh: '15/59$', t: '74$', osr: '187', opkr: '13838', nsr: '279.67', npkr: '20695.58', inv: 'inv: 7977rs= 18000', invColor: 'bg-[#f97316]', inv2: 'Rec:8089 Rs:18000', hasAction: false },
                                            { no: '3/170360', domain: 'keembro.com', type: 'domain', day: 5, regDate: '04/04/2025', firstDate: '04/04/2025', expDate: '04/04/2026', dh: '/$', t: '0$', osr: '282', opkr: '0', nsr: '279.67', npkr: '0', inv: '', invColor: '', inv2: 'Rec:5091 Rs:5000', hasAction: false },
                                            { no: '4/51598', domain: 'shahzaibimpex.com', type: 'domain', day: 9, regDate: '08/04/2023', firstDate: '08/04/2025', expDate: '08/04/2026', dh: '18/15$', t: '33$', osr: '279', opkr: '9207', nsr: '279.67', npkr: '9229.11', inv: '', invColor: '', inv2: 'Rec:5026 Rs:7000', hasAction: false },
                                            { no: '5/127584', domain: 'kkr-services.com', type: 'domain', day: 9, regDate: '08/04/2025', firstDate: '08/04/2025', expDate: '08/04/2026', dh: '/$', t: '0$', osr: '278', opkr: '0', nsr: '279.67', npkr: '0', inv: '', invColor: '', inv2: 'Rec:5081 Rs:5000', hasAction: false },
                                            { no: '6/2784', domain: 'dentaldevices.com.pk', type: 'domain', day: 11, regDate: '10/04/2014', firstDate: '10/04/2024', expDate: '10/04/2026', dh: '15/$', t: '15$', osr: '187', opkr: '2805', nsr: '279.67', npkr: '4195.05', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '7/7413', domain: 'liviksports.com', type: 'domain', day: 11, regDate: '10/04/2025', firstDate: '10/04/2025', expDate: '10/04/2026', dh: '/$', t: '0$', osr: '281', opkr: '0', nsr: '279.67', npkr: '0', inv: '', invColor: '', inv2: 'Rec:5097 Rs:8000', hasAction: false },
                                            { no: '8/2784', domain: 'sacredinternational.pk', type: 'domain', day: 12, regDate: '11/04/2014', firstDate: '11/04/2024', expDate: '11/04/2026', dh: '15/$', t: '15$', osr: '187', opkr: '2805', nsr: '279.67', npkr: '4195.05', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '9/2784', domain: 'sacredinternational.com.pk', type: 'domain', day: 12, regDate: '11/04/2014', firstDate: '11/04/2024', expDate: '11/04/2026', dh: '15/$', t: '15$', osr: '187', opkr: '2805', nsr: '279.67', npkr: '4195.05', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '10/2876', domain: 'modestolz.at', type: 'domain', day: 13, regDate: '14/04/2025', firstDate: '12/04/2025', expDate: '12/04/2026', dh: '15/42$', t: '57$', osr: '169', opkr: '9633', nsr: '279.67', npkr: '15941.19', inv: '', invColor: '', inv2: 'Rec:5402 Rs:5000', hasAction: false },
                                            { no: '11/41328', domain: 'diprointernational.com', type: 'domain', day: 13, regDate: '12/04/2023', firstDate: '12/04/2025', expDate: '12/04/2026', dh: '13/$', t: '13$', osr: '239', opkr: '3107', nsr: '279.67', npkr: '3635.71', inv: 'inv: 7906rs= 10000', invColor: 'bg-[#f97316]', inv2: 'Rec:8028 Rs:10000', hasAction: false },
                                            { no: '12/2490', domain: 'unistarint.co.uk', type: 'domain', day: 14, regDate: '13/04/2025', firstDate: '13/04/2025', expDate: '13/04/2026', dh: '/$', t: '0$', osr: '0', opkr: '0', nsr: '279.67', npkr: '0', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: true },
                                            { no: '13/17990', domain: 'multicrafts.us', type: 'domain', day: 16, regDate: '15/04/2022', firstDate: '15/04/2025', expDate: '15/04/2026', dh: '18/6$', t: '24$', osr: '239', opkr: '5736', nsr: '279.67', npkr: '6712.08', inv: '', invColor: '', inv2: 'Rec:5052 Rs:8000', hasAction: false },
                                            { no: '14/2528', domain: 'sandrsports.co.uk', type: 'domain', day: 18, regDate: '17/04/2014', firstDate: '17/04/2024', expDate: '17/04/2026', dh: '/18$', t: '18$', osr: '279', opkr: '5022', nsr: '279.67', npkr: '5034.06', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '15/2810', domain: 'masalimtrust.com', type: 'domain', day: 18, regDate: '17/04/2015', firstDate: '17/04/2025', expDate: '17/04/2026', dh: '15/79$', t: '94$', osr: '157', opkr: '14758', nsr: '279.67', npkr: '26288.98', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '16/1267', domain: 'slcpk.com', type: 'domain', day: 18, regDate: '17/04/2025', firstDate: '17/04/2025', expDate: '17/04/2026', dh: '/$', t: '0$', osr: '288', opkr: '0', nsr: '279.67', npkr: '0', inv: '', invColor: '', inv2: 'Rec:5146 Rs:5000', hasAction: true },
                                            { no: '17/172599', domain: 'safetywearsupply.com', type: 'domain', day: 22, regDate: '21/04/2025', firstDate: '21/04/2025', expDate: '21/04/2026', dh: '/$', t: '0$', osr: '281', opkr: '0', nsr: '279.67', npkr: '0', inv: 'invoice', invColor: 'bg-[#ef4444]', hasAction: false },
                                            { no: '18/8504', domain: 'aspireindustrie.com', type: 'domain', day: 22, regDate: '21/04/2022', firstDate: '21/04/2025', expDate: '21/04/2026', dh: '/$', t: '0$', osr: '189', opkr: '0', nsr: '279.67', npkr: '0', inv: '', invColor: '', inv2: 'Rec:5027 Rs:7000', hasAction: false },
                                        ].map((row, i) => (
                                            <tr key={i} className={`border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:bg-zinc-900/50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-900/30' : ''}`}>
                                                <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.no}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.domain}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap dark:text-zinc-400">{row.type}</td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.day}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.regDate}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.firstDate}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                                                    <span className="font-medium text-[#ef4444]">{row.expDate}</span>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.dh}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.t}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.osr}</td>
                                                <td className="py-2.5 px-3 font-semibold whitespace-nowrap tabular-nums">
                                                    <span className={parseInt(String(row.opkr)) > 0 ? 'bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500' : 'text-slate-500 dark:text-slate-400'}>{row.opkr}</span>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.nsr}</td>
                                                <td className="py-2.5 px-3 font-semibold whitespace-nowrap tabular-nums">
                                                    <span className={parseFloat(String(row.npkr)) > 0 ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>{row.npkr}</span>
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {row.inv && (
                                                            <span className={`text-[9px] font-bold text-white px-2 py-0.5 rounded ${row.invColor}`}>{row.inv}</span>
                                                        )}
                                                        {(row as any).inv2 && (
                                                            <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded bg-[#f97316] dark:bg-zinc-900">{(row as any).inv2}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {(row as any).hasAction && (
                                                        <div
                                                            className="h-5 w-5 rounded-full border-[1.5px] border-[#059669]/60 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800"
                                                            onClick={() => setRenewDomainOpen(true)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Renew Domain Modal */}
            <Dialog open={renewDomainOpen} onOpenChange={setRenewDomainOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold tracking-tight">Renew Domain</h3>
                        <button onClick={() => setRenewDomainOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Company</label>
                            <Input className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Domain</label>
                            <Input className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Expire</label>
                            <Input type="date" placeholder="yyyy-m-d" className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Active</label>
                            <Select defaultValue="choose">
                                <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                    <SelectItem value="active" className="text-slate-700 font-medium dark:text-zinc-400">Active</SelectItem>
                                    <SelectItem value="inactive" className="text-slate-700 font-medium dark:text-zinc-400">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 dark:border-zinc-800">
                        <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setRenewDomainOpen(false)}>
                            Close
                        </button>
                        <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors" onClick={() => setRenewDomainOpen(false)}>
                            Save
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invoice Preview Dialog */}
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[90vh] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                    <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[16px] font-bold tracking-tight">Invoice Preview</h3>
                        <button onClick={() => setInvoiceDialogOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[calc(90vh-120px)]" id="invoice-print-area">
                        <div className="p-8 bg-white dark:bg-zinc-900" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {/* Header with Logo and Invoice Info */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-[#2d8f4e] rounded-full flex items-center justify-center text-white font-bold text-[14px]">W</div>
                                    <div>
                                        <h2 className="text-[18px] font-extrabold text-[#1a1a1a] leading-tight tracking-tight dark:text-zinc-100" style={{ fontFamily: 'Impact, sans-serif' }}>WEB EXCELS</h2>
                                        <p className="text-[8px] text-slate-500 italic -mt-0.5 dark:text-zinc-400">Design, Development & Marketing</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] text-[#ef4444] font-bold">Invoice No:{selectedInvoice?.invoiceNo}</p>
                                    <p className="text-[11px] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-bold">Date:{selectedInvoice?.create?.split(' ').slice(0, 1).join('')} {selectedInvoice?.create?.split(' ').slice(1).join(' ')}</p>
                                </div>
                            </div>

                            {/* INVOICE Title */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-[6px] flex-1 bg-[#2d8f4e] rounded"></div>
                                <h1 className="text-[28px] font-black tracking-[3px] text-[#1a1a1a] dark:text-zinc-100" style={{ fontFamily: 'Impact, sans-serif' }}>INVOICE</h1>
                                <div className="h-[6px] flex-1 bg-[#2d8f4e] rounded"></div>
                            </div>

                            {/* From / To */}
                            <div className="flex justify-between mb-6 gap-8">
                                <div className="text-[11px] text-slate-700 space-y-0.5 dark:text-zinc-400">
                                    <p className="font-bold text-[12px] text-slate-800 dark:text-zinc-100">From:</p>
                                    <p className="font-semibold">Web Excels</p>
                                    <p>+92-334-8086611 (Whatsapp)</p>
                                    <p>+92-52-4271592</p>
                                    <p className="text-blue-600">Support@webexcels.com</p>
                                    <p className="mt-1 text-[10px] leading-tight text-slate-500 dark:text-zinc-400">Al-Amin Center, Paris Rd, Opposite The<br />Sialkot Chamber Of Commerce, Sialkot<br />51310 Pakistan.</p>
                                </div>
                                <div className="text-[11px] text-slate-700 space-y-0.5 text-right dark:text-zinc-400">
                                    <p className="font-bold text-[12px] text-slate-800 dark:text-zinc-100">To:</p>
                                    <p className="font-semibold">{selectedInvoice?.toCompany}</p>
                                    <p><span className="font-semibold">Phone:</span>{selectedInvoice?.phone}</p>
                                    <p><span className="font-semibold">Email:</span>{selectedInvoice?.email}</p>
                                    <p><span className="font-semibold">Address:</span>{selectedInvoice?.address}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-slate-200 rounded overflow-hidden mb-4 dark:border-zinc-800">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="bg-[#2d8f4e] text-white">
                                            <th className="py-2 px-3 text-left font-bold w-10">Sl.</th>
                                            <th className="py-2 px-3 text-left font-bold">Item Description</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Price</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Quantity</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedInvoice?.items?.map((item: any, idx: number) => (
                                            <tr key={idx} className="border-t border-slate-100 dark:border-zinc-800">
                                                <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-zinc-300">{item.sl}</td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-100">{item.desc}</td>
                                                <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-zinc-300">{item.price}</td>
                                                <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-zinc-300">{item.qty}</td>
                                                <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-zinc-400">{item.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end mb-6">
                                <div className="space-y-1.5 text-[12px] text-right min-w-[220px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-700 dark:text-zinc-400">Sub Total:</span>
                                        <span className="font-bold text-slate-800 dark:text-zinc-100">{selectedInvoice?.subTotal}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-700 dark:text-zinc-400">Sub Total:</span>
                                        <span className="font-bold text-[#f97316]">{selectedInvoice?.subTotalPkr}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-700 dark:text-zinc-400">Discount:</span>
                                        <span className="font-bold text-[#ef4444]">{selectedInvoice?.discount}</span>
                                    </div>
                                    <div className="flex justify-between bg-[#2d8f4e] text-white px-3 py-1.5 rounded mt-1">
                                        <span className="font-bold">Total:</span>
                                        <span className="font-bold">{selectedInvoice?.totalPkr}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t-2 border-[#2d8f4e] pt-3 mt-6 dark:border-zinc-800">
                                <p className="text-center text-[10px] text-slate-500 font-medium dark:text-zinc-400">
                                    This <span className="text-[#ef4444] font-bold">Invoice</span> Only For <span className="font-bold text-slate-700 dark:text-zinc-400">{selectedInvoice?.toCompany}</span>. Copyright 2026 Reserved By <span className="font-bold text-slate-700 dark:text-zinc-400">Webexcels</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-3 bg-white sticky bottom-0 dark:bg-zinc-900 dark:border-zinc-800">
                        <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setInvoiceDialogOpen(false)}>
                            Close
                        </button>
                        <button
                            className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors"
                            onClick={() => {
                                const printArea = document.getElementById('invoice-print-area');
                                if (printArea) {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write('<html><head><title>Invoice #' + (selectedInvoice?.invoiceNo || '') + '</title><style>body{margin:0;padding:20px;font-family:Arial,sans-serif}@media print{body{padding:0}}</style></head><body>');
                                        printWindow.document.write(printArea.innerHTML);
                                        printWindow.document.write('</body></html>');
                                        printWindow.document.close();
                                        printWindow.focus();
                                        setTimeout(() => printWindow.print(), 300);
                                    }
                                }
                            }}
                        >
                            Save
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
