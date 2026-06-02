import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const REPORT_MOCK = [
    {
        idRow: 1, uid: "PKCont3613", name: "Contrive Sports", package: "Basic", status: "Renewal", person: "SHAHZAIB ZAFAR", create1: "03-12-2022", gmPay: "30-09-2024", gmDoc: "0",
        bvDate: "19-10-2023", invoice: "06-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Product Posting / 2", create2: "06-04-2026", data: "06-04-2026", hod: "03-10-2023",
        dep: "06-04-2026", p15: "2", assign: "06-04-2026", finish: "15", remaining: "15"
    },
    {
        idRow: 2, uid: "PKAMAN122404", name: "AMANO SPORTS", package: "Basic", status: "Renewal", person: "M. Arslan Janjua", create1: "02-10-2024", gmPay: "04-04-2026", gmDoc: "0",
        bvDate: "28-03-2025", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Product Posting / 62", create2: "06-04-2026", data: "06-04-2026", hod: "04-04-2025",
        dep: "0", p15: "2", assign: "0", finish: "15", remaining: "15"
    },
    {
        idRow: 3, uid: "PKVOKU214443", name: "VOKUN SPORTS", package: "Basic Plus", status: "New", person: "Saim Tariq", create1: "03-04-2026", gmPay: "03-04-2026", gmDoc: "0",
        bvDate: "30-11--0001", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Listing Page", create2: "06-04-2026", data: "06-04-2026", hod: "06-04-2026",
        dep: "0", p15: "2", assign: "0", finish: "2", remaining: "2"
    },
    {
        idRow: 4, uid: "PKAMAN122404", name: "AMANO SPORTS", package: "Basic", status: "Renewal", person: "M. Arslan Janjua", create1: "02-10-2024", gmPay: "04-04-2026", gmDoc: "0",
        bvDate: "28-03-2025", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Minisite", create2: "06-04-2026", data: "06-04-2026", hod: "04-04-2025",
        dep: "0", p15: "2", assign: "0", finish: "5", remaining: "5"
    },
    {
        idRow: 5, uid: "PKVOKU214443", name: "VOKUN SPORTS", package: "Basic Plus", status: "New", person: "Saim Tariq", create1: "03-04-2026", gmPay: "03-04-2026", gmDoc: "0",
        bvDate: "30-11--0001", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Minisite", create2: "06-04-2026", data: "06-04-2026", hod: "06-04-2026",
        dep: "0", p15: "2", assign: "0", finish: "5", remaining: "5"
    },
    {
        idRow: 6, uid: "PKAMAN122404", name: "AMANO SPORTS", package: "Basic", status: "Renewal", person: "M. Arslan Janjua", create1: "02-10-2024", gmPay: "04-04-2026", gmDoc: "0",
        bvDate: "28-03-2025", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Listing Page", create2: "06-04-2026", data: "06-04-2026", hod: "04-04-2025",
        dep: "0", p15: "2", assign: "0", finish: "2", remaining: "2"
    },
    {
        idRow: 7, uid: "PKVOKU214443", name: "VOKUN SPORTS", package: "Basic Plus", status: "New", person: "Saim Tariq", create1: "03-04-2026", gmPay: "03-04-2026", gmDoc: "0",
        bvDate: "30-11--0001", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Product Posting / 62", create2: "06-04-2026", data: "06-04-2026", hod: "06-04-2026",
        dep: "0", p15: "2", assign: "0", finish: "15", remaining: "15"
    },
    {
        idRow: 8, uid: "PKCROW201238", name: "CROWN GATE INTERNATIONAL", package: "Basic Plus", status: "New", person: "Saim Tariq", create1: "12-01-2026", gmPay: "21-01-2026", gmDoc: "0",
        bvDate: "03-04-2026", invoice: "03-04-2026", receipt: "06-04-2026", method: "Free", project: "Alibaba Product Posting / 100", create2: "06-04-2026", data: "06-04-2026", hod: "14-01-2026",
        dep: "06-04-2026", p15: "32", assign: "06-04-2026", finish: "15", remaining: "15"
    },
    {
        idRow: 9, uid: "PKAREE214645", name: "AREEB STITCH AURA", package: "", status: "", person: "Ghazanfar ali", create1: "04-04-2026", gmPay: "0", gmDoc: "0",
        bvDate: "01-01-1970", invoice: "04-04-2026", receipt: "04-04-2026", method: "Bank Transfar", project: "Domain Registration", create2: "04-04-2026", data: "04-04-2026", hod: "04-04-2026",
        dep: "0", p15: "32", assign: "0", finish: "", remaining: "0"
    },
];

export default function PmsProjectReport() {
    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans flex flex-col max-h-screen dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 flex-shrink-0 dark:text-zinc-400">
                CHECK PROJECT REPORTS
            </h1>

            {/* Filter Section */}
            <div className="bg-white rounded border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-end mb-6 shadow-sm flex-shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex flex-col gap-2 w-full md:w-1/3">
                    <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Company Name</label>
                    <Input placeholder="Enter name" className="h-10 text-[13px]" />
                </div>
                <div className="flex flex-col gap-2 w-full md:w-1/4">
                    <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Start Date</label>
                    <div className="relative">
                        <Input 
                            type="date" 
                            className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                            onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                        />
                        <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-1/4">
                    <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">End Date</label>
                    <div className="relative">
                        <Input 
                            type="date" 
                            className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                            onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                        />
                        <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="w-full md:w-auto">
                    <Button className="h-10 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide">
                        View
                    </Button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <Table className="w-full min-w-[2000px] border-collapse relative">
                        <TableHeader>
                            <TableRow className="bg-[#f0f2f5] hover:bg-[#f0f2f5] dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 w-[50px] dark:text-zinc-400">#</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Package</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Status</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">GM Pay</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">GM Doc</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">BV Date</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Invoice</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Receipt</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Method</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Project</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Data</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Hod</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Dep</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">15P</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Assign</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400">Finish</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 dark:text-zinc-400">Remaning</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {REPORT_MOCK.map((row) => (
                                <TableRow key={row.idRow} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="text-[12.5px] font-bold text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.idRow}</TableCell>
                                    <TableCell className="text-[12.5px] font-bold text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.uid}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 uppercase dark:text-zinc-400">{row.name}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.package}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.status}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.person}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.create1}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.gmPay}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.gmDoc}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.bvDate}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.invoice}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.receipt}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.method}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.project}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.create2}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.data}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.hod}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.dep}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.p15}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.assign}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.finish}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400">{row.remaining}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
