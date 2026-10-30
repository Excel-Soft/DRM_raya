import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Wallet } from "lucide-react";

interface DuePaymentRow {
  id: string;
  companyName: string | null;
  salesPerson: string | null;
  total: number;
  pay: number;
  due: number;
  date: string;
}

interface DuePaymentResponse {
  success: boolean;
  data: DuePaymentRow[];
  totals: { total: number; pay: number; due: number };
}

function formatCurrency(amount: number | string | null) {
  if (amount === null || amount === undefined) return "-";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function DuePaymentReport() {
  const { data: reportData, isLoading } = useQuery<DuePaymentResponse>({
    queryKey: ["/api/reports/due-payments"],
    queryFn: () => fetch("/api/reports/due-payments", { headers: getAuthHeader(), credentials: "include" }).then((r) => r.json()),
  });

  const rows = reportData?.data || [];
  const totals = reportData?.totals || { total: 0, pay: 0, due: 0 };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">All Due Payment</h1>
          <p className="text-muted-foreground">Invoices that are partially paid and still have an outstanding balance</p>
        </div>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Due Payments
            </CardTitle>
            <Badge variant="outline">{rows.length} records</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No due payments found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No.</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Sale Person</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pay</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.id} className={index % 2 === 0 ? "bg-muted/30" : ""} data-testid={`row-due-payment-${row.id}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.companyName || "-"}</TableCell>
                        <TableCell>{row.salesPerson || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.total)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.pay)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-red-600">{formatCurrency(row.due)}</TableCell>
                        <TableCell>{formatDate(row.date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.total)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.pay)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{formatCurrency(totals.due)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
