import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  RotateCcw, 
  Calendar, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import type { RefundGmEntry } from "@shared/schema";

interface RefundReportResponse {
  data: RefundGmEntry[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
}

const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    Approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Verified: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    Rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    Completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    "Manager Approved": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    "HOD Approved": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

export default function RefundReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("pageSize", pageSize.toString());
  if (startDate) queryParams.set("from", startDate);
  if (endDate) queryParams.set("to", endDate);
  if (searchQuery) queryParams.set("company", searchQuery);

  const { data: reportData, isLoading } = useQuery<RefundReportResponse>({
    queryKey: ["/api/reports/refund-entries", startDate, endDate, searchQuery, currentPage],
    queryFn: () => fetch(`/api/reports/refund-entries?${queryParams}`).then(r => r.json()),
  });

  const entries = reportData?.data || [];
  const total = reportData?.total || 0;
  const totalAmount = reportData?.totalAmount || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("from", startDate);
    if (endDate) params.set("to", endDate);
    if (searchQuery) params.set("company", searchQuery);
    
    const url = `/api/reports/refund-entries/export-csv?${params}`;
    window.open(url, "_blank");
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatCurrency = (amount: number | string | null, type = "USD") => {
    if (amount === null || amount === undefined) return "-";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${type} ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Refund Report</h1>
            <p className="text-muted-foreground">Track GM refund entries</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card className="rounded-xl shadow-md bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Refunds</p>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{total} refund entries</p>
              </div>
              <TrendingDown className="h-12 w-12 text-red-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Search Company</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Company name..."
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Refund Entries
            </CardTitle>
            <Badge variant="outline">{total} records</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No refund entries found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No#</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Person Name</TableHead>
                        <TableHead>Amount Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, index) => (
                        <TableRow 
                          key={entry.id} 
                          className={index % 2 === 0 ? "bg-muted/30" : ""}
                          data-testid={`row-refund-${entry.id}`}
                        >
                          <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="font-medium">{entry.companyName}</TableCell>
                          <TableCell>{entry.personName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.amountType}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(entry.amount, entry.amountType)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(entry.status)}>
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
