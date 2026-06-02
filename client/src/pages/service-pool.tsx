import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getAuthHeader } from "@/lib/queryClient";

type ServicePoolSummary = {
    allInService: number;
    dropoutIn1Year: number;
    dropoutMoreThan1Year: number;
    currentQ: number;
    duplicateData: number;
};

type ServicePoolEntry = {
    id: string;
    drmId: string | null;
    companyName: string;
    salesPersonName: string | null;
    servicePersonName: string | null;
    taPersonName: string | null;
    accountHolder: string | null;
    contactNo: string | null;
    status: string;
    dropoutCategory: string | null;
    startedAt: string;
    updatedAt: string;
};

export default function ServicePool() {
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("allInService");
    const pageSize = 10;

    const { data: summary } = useQuery<ServicePoolSummary>({
        queryKey: ["/api/sales/service-pool/summary"],
        queryFn: async () => {
            const res = await fetch("/api/sales/service-pool/summary", {
                headers: getAuthHeader(),
            });
            return res.json();
        },
    });

    const { data: listData, isLoading: isLoadingList } = useQuery<{ items: ServicePoolEntry[]; total: number }>({
        queryKey: ["/api/sales/service-pool/list", page, searchTerm, activeFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(pageSize));
            if (searchTerm) params.set("search", searchTerm);

            if (activeFilter === "allInService") {
                params.set("status", "active");
            } else if (activeFilter === "dropoutIn1Year") {
                params.set("dropoutCategory", "dropout_in_1_year");
            } else if (activeFilter === "dropoutMoreThan1Year") {
                params.set("dropoutCategory", "dropout_more_than_1_year");
            } else if (activeFilter === "duplicateData") {
                params.set("duplicates", "true");
            } else if (activeFilter === "currentQ") {
                params.set("currentQ", "true");
            }

            const res = await fetch(`/api/sales/service-pool/list?${params.toString()}`, {
                headers: getAuthHeader(),
            });
            return res.json();
        },
    });

    const filters = [
        { key: "dropoutIn1Year", label: "Dropout In 1-Year", count: summary?.dropoutIn1Year || 0, color: "bg-red-500" },
        { key: "dropoutMoreThan1Year", label: "Dropout More Than 1-Year", count: summary?.dropoutMoreThan1Year || 0, color: "bg-orange-500" },
        { key: "currentQ", label: "Current Q", count: summary?.currentQ || 0, color: "bg-blue-500" },
        { key: "allInService", label: "All In Service", count: summary?.allInService || 0, color: "bg-emerald-500" },
        { key: "duplicateData", label: "Service Pool Duplicate Data", count: summary?.duplicateData || 0, color: "bg-purple-500" },
    ];

    const totalPages = Math.ceil((listData?.total || 0) / pageSize);

    return (
        <div className="flex-1 overflow-auto p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Service Pool Management</h1>
                <p className="text-muted-foreground">Monitor and track customer service delivery status</p>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => {
                                    setActiveFilter(f.key);
                                    setPage(1);
                                }}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeFilter === f.key
                                    ? "ring-2 ring-primary ring-offset-2 scale-105"
                                    : "opacity-80 hover:opacity-100"
                                    } ${f.color} text-white`}
                            >
                                <span className="font-semibold text-sm">{f.label}</span>
                                <Badge variant="secondary" className="bg-white text-white border-none dark:bg-zinc-900">
                                    {f.count}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle>Customer List</CardTitle>
                    </div>
                    <div className="relative w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search company, ID..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead className="min-w-[200px]">Company</TableHead>
                                    <TableHead>Sale Person</TableHead>
                                    <TableHead>Service Person</TableHead>
                                    <TableHead>TA Person</TableHead>
                                    <TableHead>Acc Holder</TableHead>
                                    <TableHead>Contact No</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingList ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading results...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (listData?.items ?? []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No records found in this pool.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    listData?.items.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono text-xs">{row.drmId || "-"}</TableCell>
                                            <TableCell className="font-medium">{row.companyName}</TableCell>
                                            <TableCell>{row.salesPersonName || "-"}</TableCell>
                                            <TableCell>{row.servicePersonName || "-"}</TableCell>
                                            <TableCell>{row.taPersonName || "-"}</TableCell>
                                            <TableCell>{row.accountHolder || "-"}</TableCell>
                                            <TableCell>{row.contactNo || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages || 1} ({listData?.total || 0} total)
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
