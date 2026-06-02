import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";

export default function ServicePoolDashboard() {
    const [searchCustomer, setSearchCustomer] = useState("");

    const mockData = [
        { id: "pkSHAF15480", company: "SHAFIQ SPORTS", salePerson: "Muhammad Allian Ahmed", expire: "2031-06-27", create: "25-11-2022" },
        { id: "PKBAJW9286", company: "BAJWAT SPORTS", salePerson: "Saim Tariq", expire: "2029-03-02", create: "12-02-2026" },
        { id: "PKADVA155065", company: "ADVAS INTERNATIONAL", salePerson: "Zill E Huma", expire: "2028-03-19", create: "04-04-2025" },
        { id: "pkSIAN15579", company: "SIAN ENTERPRISES", salePerson: "Rehman Faisal", expire: "2028-03-17", create: "26-04-2025" },
        { id: "MY A57928", company: "MY ABILITY SPORTS", salePerson: "Rehman Faisal", expire: "2028-03-12", create: "26-04-2025" },
        { id: "PKBAFA187827", company: "BAFA SURGICAL INSTRUMENTS", salePerson: "Hareem Tariq", expire: "2027-11-24", create: "25-02-2026" },
        { id: "pkCROS15195", company: "CROSS WEAR", salePerson: "Warda Akhtar", expire: "2027-09-20", create: "24-11-2022" },
        { id: "pkSAFE15306", company: "SAFEER AHSAN INTERNATIONAL", salePerson: "Faiza Khalid", expire: "2027-03-25", create: "04-04-2025" },
        { id: "PKSTYL4239", company: "STYLEEN CO INTERNATIONAL", salePerson: "Rohina Munir", expire: "2027-03-25", create: "30-08-2024" },
        { id: "pkGEMS15936", company: "GEMSTONE ENTERPRISES", salePerson: "Ghazanfar ali", expire: "2027-03-23", create: "27-03-2025" },
    ];

    return (
        <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 font-sans p-4 min-h-screen">
            {/* CUSTOMER LIST TITLE */}
            <div className="mb-4 flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">CUSTOMER LIST</h2>
                <span className="bg-[#bbf7d0] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 text-[12px] font-bold px-2 py-0.5 rounded-full">100</span>
            </div>

            {/* Search Area */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 mb-8 dark:bg-zinc-900">
                <div>
                    <label className="block text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Search Customer</label>
                    <Input
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        placeholder="Enter company name/mobile/email"
                        className="text-[13px] h-10 border-slate-200 dark:border-zinc-800"
                    />
                </div>
            </div>

            {/* TRACING Area */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">TRACING</h2>
            </div>

            {/* Table Area */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-3 dark:bg-zinc-900">
                <div className="overflow-x-auto rounded border border-slate-50 dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="w-10 pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">ID</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Company</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Sale Person</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Acc Holder</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Contact No</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Expire</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Create</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockData.map((row, idx) => (
                                <TableRow key={idx} className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell className="pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                    <TableCell className="text-[12px] text-center font-semibold text-slate-500 py-3 uppercase dark:text-zinc-400">{row.id}</TableCell>
                                    <TableCell className="text-[12px] text-center font-semibold text-slate-500 py-3 uppercase dark:text-zinc-400">{row.company}</TableCell>
                                    <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 capitalize dark:text-zinc-400">{row.salePerson}</TableCell>
                                    <TableCell className="py-3"><div className="w-24 h-4 bg-slate-100 rounded blur-[3px] mx-auto dark:bg-zinc-900"></div></TableCell>
                                    <TableCell className="py-3"><div className="w-20 h-5 bg-[#34d399]/30 rounded blur-[1px] mx-auto"></div></TableCell>
                                    <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{row.expire}</TableCell>
                                    <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{row.create}</TableCell>
                                    <TableCell className="py-3">
                                        <div className="w-6 h-6 rounded-full bg-[#34d399] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-500 mx-auto">
                                            <User className="w-3.5 h-3.5" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
