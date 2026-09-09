import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DashboardCounts = {
    grades?: {
        A?: number;
        B_PLUS?: number;
        B?: number;
        B_MINUS?: number;
    };
    complaints?: Record<string, number>;
    dueFollowups?: number;
    dropouts?: number;
    duePayments?: number;
};

const GRADE_BUCKETS: { key: keyof NonNullable<DashboardCounts["grades"]>; label: string; path: string }[] = [
    { key: "A", label: "A", path: "/service/a-customer" },
    { key: "B_PLUS", label: "B+", path: "/service/b-plus-customer" },
    { key: "B", label: "B", path: "/service/b-customer" },
    { key: "B_MINUS", label: "B-", path: "/service/b-minus-customer" },
];

export default function ServiceGradeList() {
    const [, setLocation] = useLocation();

    const { data, isLoading } = useQuery<DashboardCounts>({
        queryKey: ["/api/service/dashboard/counts"],
        queryFn: async () => apiRequestJson("GET", "/api/service/dashboard/counts"),
    });

    const grades = data?.grades ?? {};

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">GRADE SYSTEM</h2>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="mb-4">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">View Grade List</h3>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#d1fae5] border-b border-slate-200 hover:bg-[#d1fae5] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">#</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Grade</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Customers</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap text-right dark:text-zinc-100">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {GRADE_BUCKETS.map((bucket, idx) => (
                                <TableRow key={bucket.key} className="hover:bg-slate-50 border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{idx + 1}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{bucket.label}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">
                                        {isLoading ? "—" : (grades[bucket.key] ?? 0)}
                                    </TableCell>
                                    <TableCell className="py-3 text-right">
                                        <Button
                                            onClick={() => setLocation(bucket.path)}
                                            className="bg-[#059669] hover:bg-[#047857] text-white px-5 h-8 rounded text-[12px] font-medium"
                                        >
                                            View
                                        </Button>
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
