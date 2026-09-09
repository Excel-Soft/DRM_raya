import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InvoicePool() {
  const [activeTab, setActiveTab] = useState("Approved");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/invoice-pool"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/invoice-pool");
      return res.json();
    }
  });

  const { data: invoiceDetails, isLoading: detailsLoading } = useQuery<any>({
    queryKey: ["/api/sales/invoice-pool", selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return null;
      const res = await apiRequest("GET", `/api/sales/invoice-pool/${selectedInvoiceId}`);
      return res.json();
    },
    enabled: !!selectedInvoiceId
  });

  const invoiceDepartmentLabel = (inv: any): string => {
    switch (inv?.invoiceType) {
      case "LISTING_PAGE": return "Listing Page";
      case "MINIWEBSITE": return "Alibaba Minisite";
      case "PRODUCT_POSTING": return "Product Posting";
      default: return inv?.serviceType || "Posting";
    }
  };

  const invoiceItemDetail = (inv: any): string => {
    return inv?.invoiceType === "PRODUCT_POSTING" ? "100" : "1";
  };

  const invoiceItemQty = (inv: any): number => {
    return inv?.invoiceType === "PRODUCT_POSTING" ? 100 : 1;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "REJECTED": return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
      default: return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
  };

  // "Approved" here tracks the Sales Executive's own concern — has HOD signed
  // off? — not whether Accounts has also finished, which is a separate
  // back-office step still visible per-row in the Account Status column.
  // Only an invoice still waiting on HOD itself counts as "Pending".
  const isHodApprovedStatus = (s: string) => s === "PENDING_ACCOUNT" || s === "APPROVED";
  const isPendingHodStatus = (s: string) => s === "PENDING_HOD" || s === "PENDING";

  const getTabCounts = () => {
    return {
      Approved: invoices.filter(i => isHodApprovedStatus(i.finalStatus?.toUpperCase() || "")).length,
      Pending: invoices.filter(i => isPendingHodStatus(i.finalStatus?.toUpperCase() || "")).length,
      Rejected: invoices.filter(i => {
        const s = i.finalStatus?.toUpperCase() || "";
        return s === "REJECTED";
      }).length,
    };
  };

  const filteredInvoices = invoices.filter(i => {
    const s = i.finalStatus?.toUpperCase() || "";
    if (activeTab === "Approved") return isHodApprovedStatus(s);
    if (activeTab === "Pending") return isPendingHodStatus(s);
    if (activeTab === "Rejected") return s === "REJECTED";
    return true;
  });

  const counts = getTabCounts();

  const renderDetailsDialog = () => {
    if (!selectedInvoiceId) return null;
    return (
      <Dialog open={!!selectedInvoiceId} onOpenChange={(open) => !open && setSelectedInvoiceId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-800">Invoice Details</DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-8 text-center text-slate-500">Loading invoice details...</div>
          ) : invoiceDetails ? (
            <div className="space-y-8 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Client Information */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-4">Client Information</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold w-1/3 text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Invoice ID</TableCell>
                          <TableCell>{invoiceDetails.invoiceNumber || invoiceDetails.id}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Client Name</TableCell>
                          <TableCell>{invoiceDetails.company_name || invoiceDetails.account_name || "N/A"}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Email</TableCell>
                          <TableCell>{invoiceDetails.email || "-"}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Phone</TableCell>
                          <TableCell>{invoiceDetails.phone || invoiceDetails.mobile || "-"}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Address</TableCell>
                          <TableCell>{invoiceDetails.city || "-"}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Invoice Information */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-4">Invoice Information</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold w-1/3 text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Sub Total</TableCell>
                          <TableCell>{Number(invoiceDetails.amount || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Discount</TableCell>
                          <TableCell>0</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Grand Total</TableCell>
                          <TableCell>{Number(invoiceDetails.amount || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">HOD Status</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(invoiceDetails.status === 'REJECTED' ? 'REJECTED' : invoiceDetails.status === 'PENDING_ACCOUNT' || invoiceDetails.status === 'APPROVED' ? 'APPROVED' : invoiceDetails.status)}>
                              {invoiceDetails.status === 'REJECTED' ? 'Rejected' : invoiceDetails.status === 'PENDING_ACCOUNT' || invoiceDetails.status === 'APPROVED' ? 'Approved' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Account Status</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(invoiceDetails.status === 'REJECTED' ? 'REJECTED' : invoiceDetails.status === 'APPROVED' ? 'APPROVED' : 'PENDING')}>
                              {invoiceDetails.status === 'REJECTED' ? 'Rejected' : invoiceDetails.status === 'APPROVED' ? 'Paid' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {invoiceDetails.status === 'REJECTED' && (
                          <TableRow>
                            <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Rejection Reason</TableCell>
                            <TableCell className="text-rose-600">{invoiceDetails.rejectionReason || "-"}</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Invoice Department</TableCell>
                          <TableCell>{invoiceDepartmentLabel(invoiceDetails)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Created Date</TableCell>
                          <TableCell>{new Date(invoiceDetails.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Updated Date</TableCell>
                          <TableCell>{new Date(invoiceDetails.updated_at).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold text-slate-600 bg-slate-50/50 dark:bg-zinc-900">Comment</TableCell>
                          <TableCell>{invoiceDetails.notes || "-"}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Invoice Items</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Item</TableHead>
                        <TableHead className="font-bold text-slate-700">Detail</TableHead>
                        <TableHead className="font-bold text-slate-700">Unit Price</TableHead>
                        <TableHead className="font-bold text-slate-700">Qty</TableHead>
                        <TableHead className="font-bold text-slate-700 text-right">Total PKR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{invoiceDetails.project_name || "N/A"}</TableCell>
                        <TableCell>{invoiceItemDetail(invoiceDetails)}</TableCell>
                        <TableCell>{Number(invoiceDetails.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>{invoiceItemQty(invoiceDetails)}</TableCell>
                        <TableCell className="text-right">{Number(invoiceDetails.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Payment Details</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Item</TableHead>
                        <TableHead className="font-bold text-slate-700">Paid Amount</TableHead>
                        <TableHead className="font-bold text-slate-700">Method</TableHead>
                        <TableHead className="font-bold text-slate-700 text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{invoiceDetails.project_name || "N/A"}</TableCell>
                        <TableCell>{Number(invoiceDetails.paidAmount || 0).toLocaleString()}</TableCell>
                        <TableCell>{invoiceDetails.paymentMethod || "-"}</TableCell>
                        <TableCell className="text-right">{invoiceDetails.paidDate ? new Date(invoiceDetails.paidDate).toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">Failed to load invoice details.</div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        INVOICE POOL
      </h1>

      {renderDetailsDialog()}

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <div className="border-b border-slate-200 dark:border-zinc-800">
          <div className="flex px-4 gap-6">
            {["Approved", "Pending", "Rejected"].map((tab) => {
              const count = counts[tab as keyof typeof counts];
              const isActive = activeTab === tab;
              const badgeColor = 
                tab === "Approved" ? (isActive ? "bg-emerald-500" : "bg-emerald-500/50") :
                tab === "Pending" ? (isActive ? "bg-amber-500" : "bg-amber-500/50") :
                (isActive ? "bg-rose-500" : "bg-rose-500/50");

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-2 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${
                    isActive 
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab}
                  <Badge className={`${badgeColor} text-white hover:${badgeColor} border-none rounded-full px-2 py-0.5 text-xs`}>
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-zinc-900/50">
              <TableRow>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Invoice ID</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Client</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Grand Total</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">HOD Status</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Account Status</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Final Status</TableHead>
                <TableHead className="font-bold text-slate-600 dark:text-zinc-300">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    No {activeTab.toLowerCase()} invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[120px]" title={invoice.id}>
                      {invoice.invoiceNumber || invoice.id}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-zinc-400">
                      {invoice.client || "N/A"}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700 dark:text-zinc-300">
                      Rs. {Number(invoice.grandTotal || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(invoice.hodStatus)}>
                        {invoice.hodStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(invoice.accountStatus)}>
                        {invoice.accountStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(isHodApprovedStatus(invoice.finalStatus?.toUpperCase() || "") ? "APPROVED" : isPendingHodStatus(invoice.finalStatus?.toUpperCase() || "") ? "PENDING" : "REJECTED")}>
                        {isHodApprovedStatus(invoice.finalStatus?.toUpperCase() || "") ? "Approved" : isPendingHodStatus(invoice.finalStatus?.toUpperCase() || "") ? "Pending" : "Rejected"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {activeTab === "Rejected" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
