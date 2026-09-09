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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  Calendar, 
  Download, 
  Search,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from "lucide-react";
import type { Invoice } from "@shared/schema";

interface InvoiceReportResponse {
  data: Invoice[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
}

const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Overdue", "Cancelled"];

const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    Sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    Paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    Cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

export default function InvoiceReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const queryParams = new URLSearchParams();
  queryParams.set("page", currentPage.toString());
  queryParams.set("pageSize", pageSize.toString());
  if (startDate) queryParams.set("from", startDate);
  if (endDate) queryParams.set("to", endDate);
  if (searchQuery) queryParams.set("company", searchQuery);
  if (filterStatus) queryParams.set("status", filterStatus);

  const { data: reportData, isLoading } = useQuery<InvoiceReportResponse>({
    queryKey: ["/api/reports/invoice-entries", startDate, endDate, searchQuery, filterStatus, currentPage],
    queryFn: () => fetch(`/api/reports/invoice-entries?${queryParams}`, { headers: getAuthHeader(), credentials: "include" }).then(r => r.json()),
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
    
    const url = `/api/reports/invoice-entries/export-csv?${params}`;
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
    setFilterStatus("");
    setCurrentPage(1);
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Invoice Report</h1>
            <p className="text-muted-foreground">Track all invoices and payments</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card className="rounded-xl shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoice Amount</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{total} invoices</p>
              </div>
              <DollarSign className="h-12 w-12 text-blue-600 opacity-80" />
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
            <div className="grid gap-4 md:grid-cols-5">
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
                <Label>Status</Label>
                <Select value={filterStatus || "all"} onValueChange={(val) => setFilterStatus(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search Customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Customer name..."
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices
            </CardTitle>
            <Badge variant="outline">{total} records</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No invoices found</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No#</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, index) => (
                        <TableRow 
                          key={entry.id} 
                          className={index % 2 === 0 ? "bg-muted/30" : ""}
                          data-testid={`row-invoice-${entry.id}`}
                        >
                          <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="font-mono">{entry.invoiceNumber}</TableCell>
                          <TableCell className="font-medium">{entry.customerName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(entry.total, entry.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(entry.status)}>
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(entry.issueDate)}</TableCell>
                          <TableCell>{formatDate(entry.dueDate)}</TableCell>
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
