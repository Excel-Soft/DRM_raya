import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";
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
  Book, 
  Calendar, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText
} from "lucide-react";
import type { LedgerEntry } from "@shared/schema";

interface LedgerResponse {
  data: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalGM: number;
    totalRefund: number;
    totalInvoice: number;
    totalDonation: number;
    outstandingDues: number;
  };
}

const getEntryTypeBadgeColor = (entryType: string) => {
  const colors: Record<string, string> = {
    Credit: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Debit: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    GM: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Refund: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    Invoice: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    Donation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  };
  return colors[entryType] || "bg-gray-100 text-gray-800";
};

export default function LedgerReport() {
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

  const { data: reportData, isLoading } = useQuery<LedgerResponse>({
    queryKey: ["/api/reports/ledger", startDate, endDate, searchQuery, currentPage],
    queryFn: () => fetch(`/api/reports/ledger?${queryParams}`, { headers: getAuthHeader(), credentials: "include" }).then(r => r.json()),
  });

  const entries = reportData?.data || [];
  const total = reportData?.total || 0;
  const summary = reportData?.summary || { totalGM: 0, totalRefund: 0, totalInvoice: 0, totalDonation: 0, outstandingDues: 0 };
  const totalPages = Math.ceil(total / pageSize);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("from", startDate);
    if (endDate) params.set("to", endDate);
    if (searchQuery) params.set("company", searchQuery);
    
    const url = `/api/reports/ledger/export-csv?${params}`;
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

  const formatCurrency = (amount: number | string | null, currency = "USD") => {
    if (amount === null || amount === undefined) return "-";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const summaryCards = [
    { label: "Total GM", value: summary.totalGM, icon: TrendingUp, color: "text-green-600" },
    { label: "Total Invoices", value: summary.totalInvoice, icon: FileText, color: "text-blue-600" },
    { label: "Total Refunds", value: summary.totalRefund, icon: TrendingDown, color: "text-red-600" },
    { label: "Total Donations", value: summary.totalDonation, icon: DollarSign, color: "text-purple-600" },
  ];

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Company Ledger Report</h1>
            <p className="text-muted-foreground">Track financial transactions by company</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="rounded-xl shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className={`text-2xl font-bold ${card.color}`}>
                        {formatCurrency(card.value)}
                      </p>
                    </div>
                    <Icon className={`h-8 w-8 ${card.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-xl shadow-md bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Dues</p>
                <p className="text-3xl font-bold text-orange-600">
                  {formatCurrency(summary.outstandingDues)}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-orange-600 opacity-80" />
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
              <Book className="h-5 w-5" />
              Ledger Entries
            </CardTitle>
            <Badge variant="outline">{total} records</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No ledger entries found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No#</TableHead>
                        <TableHead>Entry Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference ID</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, index) => (
                        <TableRow 
                          key={entry.id} 
                          className={index % 2 === 0 ? "bg-muted/30" : ""}
                          data-testid={`row-ledger-${entry.id}`}
                        >
                          <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell>
                            <Badge className={getEntryTypeBadgeColor(entry.entryType)}>
                              {entry.entryType}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.category}</TableCell>
                          <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {entry.referenceId || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(entry.amount, entry.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.balanceAfter ? formatCurrency(entry.balanceAfter, entry.currency) : "-"}
                          </TableCell>
                          <TableCell>{formatDate(entry.entryDate)}</TableCell>
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
