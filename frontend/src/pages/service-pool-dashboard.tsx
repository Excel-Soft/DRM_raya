import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { User, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";

interface PoolEntry {
    id: string;
    drmId?: string;
    companyName?: string;
    salesPersonName?: string;
    accountHolder?: string;
    contactNo?: string;
    startedAt?: string;
    updatedAt?: string;
}

interface PoolListResponse {
    items: PoolEntry[];
    total: number;
}

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString() : "—");

export default function ServicePoolDashboard() {
    const [searchCustomer, setSearchCustomer] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");

    const { data, isLoading, isError } = useQuery<PoolListResponse>({
        queryKey: ["/api/sales/service-pool/list", appliedSearch],
        queryFn: async () => {
            const params = new URLSearchParams({ page: "1", pageSize: "50" });
            if (appliedSearch) params.set("search", appliedSearch);
            return apiRequestJson<PoolListResponse>("GET", `/api/sales/service-pool/list?${params.toString()}`);
        },
    });

    const rows = data?.items ?? [];

    return (
        <div className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 font-sans p-4 min-h-screen">
            <div className="mb-4 flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">CUSTOMER LIST</h2>
                <span className="bg-[#bbf7d0] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 text-[12px] font-bold px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
            </div>

            {/* Search Area */}
            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 mb-8 dark:bg-zinc-900">
                <div>
                    <label className="block text-[13px] font-semibold text-slate-500 mb-2 dark:text-zinc-400">Search Customer</label>
                    <Input
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(searchCustomer.trim()); }}
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
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Started</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Updated</TableHead>
                                <TableHead className="text-[12px] text-center font-bold text-slate-600 py-3 dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                                        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading service pool…
                                    </TableCell>
                                </TableRow>
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center text-rose-500">Failed to load service pool. Please try again.</TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-10 text-center text-slate-500">No service pool entries found.</TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow key={row.id} className="border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                                        <TableCell className="pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                        <TableCell className="text-[12px] text-center font-semibold text-slate-500 py-3 uppercase dark:text-zinc-400">{row.drmId || "—"}</TableCell>
                                        <TableCell className="text-[12px] text-center font-semibold text-slate-500 py-3 uppercase dark:text-zinc-400">{row.companyName || "—"}</TableCell>
                                        <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 capitalize dark:text-zinc-400">{row.salesPersonName || "—"}</TableCell>
                                        <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{row.accountHolder || "—"}</TableCell>
                                        <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{row.contactNo || "—"}</TableCell>
                                        <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{fmtDate(row.startedAt)}</TableCell>
                                        <TableCell className="text-[12px] text-center font-medium text-slate-500 py-3 dark:text-zinc-400">{fmtDate(row.updatedAt)}</TableCell>
                                        <TableCell className="py-3">
                                            <div className="w-6 h-6 rounded-full bg-[#34d399] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-500 mx-auto">
                                                <User className="w-3.5 h-3.5" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
