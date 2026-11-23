import { useState } from "react";
import { useLocation } from "wouter";
import { planDomainRenewal, renewalQuotationUrl, customerDetailUrl } from "@/lib/domain-renewal";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { User, RefreshCw, FileText, Download, Copy, Printer, Globe, Loader2, ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { utils, writeFile } from "xlsx";

const fmtDate = (d: string | null | undefined) =>
  d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString() : "N/A";

// Derive a real renewal status from the stored expiry date instead of a
// hardcoded "Renew" label. it_domains has no separate status-per-asset column,
// so the badge is computed honestly from the date itself.
function expiryStatus(dateStr: string | null | undefined): { label: string; cls: string } {
  if (!dateStr || isNaN(new Date(dateStr).getTime())) {
    return { label: "N/A", cls: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" };
  }
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (days <= 30) return { label: `${days}d left`, cls: "bg-amber-100 text-amber-700" };
  return { label: "Active", cls: "bg-emerald-100 text-emerald-700" };
}

// Compose a renewal reminder message from real row fields. There is no WhatsApp
// / SMS provider wired in, so the only honest action is copy-to-clipboard.
function MessageComposer({ item, onCopied }: { item: any; onCopied: () => void }) {
  const initial =
    `Reminder for ${item.domainName || item.domain || "your domain"}:\n` +
    `Domain expiry: ${fmtDate(item.expiryDate)}\n` +
    `Hosting expiry: ${fmtDate(item.hostingExpiryDate)}\n` +
    `SSL expiry: ${fmtDate(item.sslExpiryDate)}\n\n` +
    `Please contact us to arrange renewal.`;
  const [msg, setMsg] = useState(initial);
  return (
    <div className="space-y-4">
      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="min-h-[120px] bg-slate-50 border-slate-200 resize-none dark:bg-zinc-900 dark:border-zinc-800"
      />
      <Button
        onClick={() => {
          navigator.clipboard.writeText(msg);
          onCopied();
        }}
        className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 font-bold uppercase text-[11px] tracking-wide flex items-center gap-2"
      >
        <Copy className="h-4 w-4" /> Copy Message
      </Button>
    </div>
  );
}

interface DomainForm {
  customerId: string;
  domainName: string;
  registryId: string;
  serverId: string;
  hostingPackageId: string;
  activationDate: string;
  expiryDate: string;
  cpanelUsername: string;
}

const EMPTY_DOMAIN_FORM: DomainForm = {
  customerId: "",
  domainName: "",
  registryId: "",
  serverId: "",
  hostingPackageId: "",
  activationDate: "",
  expiryDate: "",
  cpanelUsername: "",
};

const DOMAIN_HOSTNAME_RE =
  /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function extractErrorMessage(err: any, fallback: string): string {
  const raw = String(err?.message ?? "");
  const idx = raw.indexOf(":");
  const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not JSON */
  }
  return body || fallback;
}

function customerLabel(c: any): string {
  return c?.companyName || c?.accountName || c?.name || c?.email || c?.id || "Unknown";
}

export default function ItDomains() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [, setLocation] = useLocation();
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: domains = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/it/domains"],
  });

  const { data: servers = [] } = useQuery<any[]>({
    queryKey: ["/api/it/servers"],
  });

  const { data: registries = [] } = useQuery<any[]>({
    queryKey: ["/api/it/registries"],
  });

  const { data: hostingPackages = [] } = useQuery<any[]>({
    queryKey: ["/api/it/hosting-packages"],
  });

  const { data: customersResp } = useQuery<{ customers: any[] }>({
    queryKey: ["/api/customers", "domain-picker"],
    queryFn: () => apiRequestJson("GET", "/api/customers?pageSize=200"),
  });
  const customersList = Array.isArray(customersResp?.customers) ? customersResp!.customers : [];

  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [domainForm, setDomainForm] = useState<DomainForm>(EMPTY_DOMAIN_FORM);
  const [domainFormError, setDomainFormError] = useState<string | null>(null);
  const [deleteConfirmDomain, setDeleteConfirmDomain] = useState<any | null>(null);

  const saveDomainMutation = useMutation({
    mutationFn: async (payload: { id: string | null; body: Record<string, any> }) => {
      if (payload.id) {
        return apiRequestJson("PATCH", `/api/it/domains/${payload.id}`, payload.body);
      }
      return apiRequestJson("POST", "/api/it/domains", payload.body);
    },
    onSuccess: () => {
      toast({ title: editingDomainId ? "Domain updated" : "Domain added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/domains"] });
      setDomainDialogOpen(false);
      setDomainForm(EMPTY_DOMAIN_FORM);
      setDomainFormError(null);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err, "Failed to save domain");
      setDomainFormError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/it/domains/${id}`),
    onSuccess: () => {
      toast({ title: "Domain deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/domains"] });
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to delete domain"), variant: "destructive" })
  });

  const openCreateDomain = () => {
    setEditingDomainId(null);
    setDomainForm(EMPTY_DOMAIN_FORM);
    setDomainFormError(null);
    setDomainDialogOpen(true);
  };

  const openEditDomain = (item: any) => {
    setEditingDomainId(item.id);
    const dateToYMD = (d: string | null | undefined) => {
      if (!d) return "";
      const date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    };
    setDomainForm({
      customerId: item.customerId ?? "",
      domainName: item.domainName ?? item.domain ?? "",
      registryId: item.registryId ?? "",
      serverId: item.serverId ?? "",
      hostingPackageId: item.hostingPackageId ?? "",
      activationDate: dateToYMD(item.activationDate),
      expiryDate: dateToYMD(item.expiryDate),
      cpanelUsername: item.cpanelUsername ?? "",
    });
    setDomainFormError(null);
    setDomainDialogOpen(true);
  };

  const submitDomainForm = () => {
    const domainName = domainForm.domainName.trim();
    if (!domainName) {
      setDomainFormError("Domain name is required");
      return;
    }
    if (!DOMAIN_HOSTNAME_RE.test(domainName)) {
      setDomainFormError("Enter a valid domain name (e.g. example.com)");
      return;
    }
    if (
      domainForm.activationDate &&
      domainForm.expiryDate &&
      new Date(domainForm.expiryDate) < new Date(domainForm.activationDate)
    ) {
      setDomainFormError("Expiry date cannot be before activation date");
      return;
    }
    setDomainFormError(null);
    const body: Record<string, any> = { domainName };
    body.customerId = domainForm.customerId || null;
    body.registryId = domainForm.registryId || null;
    body.serverId = domainForm.serverId || null;
    body.hostingPackageId = domainForm.hostingPackageId || null;
    body.activationDate = domainForm.activationDate || null;
    body.expiryDate = domainForm.expiryDate || null;
    body.cpanelUsername = domainForm.cpanelUsername.trim() || null;
    saveDomainMutation.mutate({ id: editingDomainId, body });
  };

  const domainsList = Array.isArray(domains) ? domains : [];
  const searchLc = searchTerm.trim().toLowerCase();
  const filteredDomains = domainsList.filter((d) =>
    !searchLc ||
    `${d.domainName || d.domain || ""} ${d.company || ""} ${d.registryName || ""} ${d.serverName || ""}`
      .toLowerCase()
      .includes(searchLc)
  );
  const totalPages = Math.max(1, Math.ceil(filteredDomains.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedDomains = filteredDomains.slice(pageStart, pageStart + pageSize);
  const pageButtons: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1) pageButtons.push(n);
    else if (pageButtons[pageButtons.length - 1] !== "gap") pageButtons.push("gap");
  }
  // "Register" = registration / activation date (old DRM reg_date); falls back to when the row was added.
  const registerDate = (d: any) => d.activationDate || d.createdAt;
  // Edit dialog: keep the current company visible even if it is not in the first 200 customers.
  const editingCompanyLabel =
    domainForm.customerId && !customersList.some((c: any) => c?.id === domainForm.customerId)
      ? domainsList.find((d: any) => d.customerId === domainForm.customerId)?.company || "Current company"
      : null;

  // Old DRM: the person icon opens the company's detail (attribute) page.
  const openCompanyDetail = (item: any) => {
    if (!item.customerId) {
      toast({ title: "No company linked", description: "Edit this domain and select its company first.", variant: "destructive" });
      return;
    }
    setLocation(customerDetailUrl(item.customerId));
  };

  // Old DRM renew button: follow-up exists -> quotation with the domain's services selected;
  // no follow-up -> open the company page to add one first.
  const startRenewal = async (item: any) => {
    if (renewingId) return;
    setRenewingId(item.id);
    try {
      const plan = await planDomainRenewal(item);
      if (plan.kind === "no-company") {
        toast({ title: "No company linked", description: "Edit this domain and select its company first.", variant: "destructive" });
        return;
      }
      if (plan.kind === "need-followup") {
        toast({
          title: "Add a follow-up first",
          description: `No follow-up in the last 60 days for ${plan.services.join(", ")}. Opening the company page to add it.`,
          variant: "destructive",
        });
        setLocation(customerDetailUrl(plan.customerId));
        return;
      }
      if (plan.skipped.length > 0) {
        toast({
          title: "Some services need a follow-up",
          description: `Added: ${plan.services.join(", ")}. Not added (no follow-up): ${plan.skipped.join(", ")}.`,
        });
      }
      setLocation(renewalQuotationUrl(plan));
    } catch (err) {
      toast({ title: extractErrorMessage(err, "Could not start the renewal"), variant: "destructive" });
    } finally {
      setRenewingId(null);
    }
  };

  const exportRows = () =>
    filteredDomains.map((d, i) => ({
      No: i + 1,
      Company: d.company || "N/A",
      Domain: d.domainName || d.domain || "",
      "Domain Expiry": fmtDate(d.expiryDate),
      "Hosting Expiry": fmtDate(d.hostingExpiryDate),
      "SSL Expiry": fmtDate(d.sslExpiryDate),
      Status: d.status || "N/A",
      Registered: fmtDate(registerDate(d)),
    }));

  const exportToCSV = () => {
    const data = exportRows();
    const headers = Object.keys(data[0]);
    const lines = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "it_domains.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const ws = utils.json_to_sheet(exportRows());
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Domains");
    writeFile(wb, "it_domains.xlsx");
  };

  const handleExport = (type: string) => {
    if (type !== "Print" && filteredDomains.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    switch (type) {
      case "Copy": {
        const text = filteredDomains
          .map((d) => `${d.company || "N/A"}\t${d.domainName || d.domain}\t${fmtDate(d.expiryDate)}`)
          .join("\n");
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Table data copied to clipboard" });
        break;
      }
      case "Print":
        window.print();
        break;
      case "Excel":
        exportToExcel();
        break;
      case "CSV":
        exportToCSV();
        break;
    }
  };

  const exportButtons = [
    { label: "Copy", icon: Copy },
    { label: "Excel", icon: Download },
    { label: "CSV", icon: FileText },
    { label: "Print", icon: Printer },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen dark:bg-zinc-950 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          header, aside, .print\\:p-0 > :not(.print-content) { display: none !important; }
          .print-content { display: block !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>
      <div className="no-print">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase dark:text-zinc-100">IT Department</h1>
      </div>

      <div className="flex justify-between items-center mt-2 no-print">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase dark:text-zinc-100">Domain / Hosting / SSL</h1>
        <Button onClick={openCreateDomain} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 px-4 flex items-center gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Add Domain
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900 print-content">
        <CardContent className="p-0">
          <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b no-print">
            <div className="flex gap-2">
              {exportButtons.map((btn) => {
                const Icon = btn.icon;
                return (
                  <Button
                    key={btn.label}
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 flex items-center gap-2"
                    onClick={() => handleExport(btn.label)}
                  >
                    <Icon className="h-4 w-4" /> {btn.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Search:</span>
              <Input
                className="h-9 w-48 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
              <TableRow>
                <TableHead className="w-12 font-bold text-slate-700 dark:text-zinc-400">No</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company Name</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain Name</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Hosting</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">SSL</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Register</TableHead>
                <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedDomains.map((item: any, idx: number) => {
                const domainExp = expiryStatus(item.expiryDate);
                const hostingExp = expiryStatus(item.hostingExpiryDate);
                const sslExp = expiryStatus(item.sslExpiryDate);
                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                    <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{pageStart + idx + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-700 dark:text-zinc-400">
                      {item.company || "N/A"}
                      {String(item.status || "").toLowerCase() === "inactive" && (
                        <Badge variant="outline" className="ml-2 text-[10px] bg-slate-100 text-slate-500 border-slate-200">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors">
                        {item.domainName || item.domain}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{fmtDate(item.expiryDate)}</div>
                      <Badge variant="secondary" className={`text-[10px] leading-none px-1.5 py-0.5 ${domainExp.cls}`}>{domainExp.label}</Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{fmtDate(item.hostingExpiryDate)}</div>
                      <Badge variant="secondary" className={`text-[10px] leading-none px-1.5 py-0.5 ${hostingExp.cls}`}>{hostingExp.label}</Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{fmtDate(item.sslExpiryDate)}</div>
                      <Badge variant="secondary" className={`text-[10px] leading-none px-1.5 py-0.5 ${sslExp.cls}`}>{sslExp.label}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm dark:text-zinc-300">{fmtDate(registerDate(item))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 no-print">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full"
                          onClick={() => openCompanyDetail(item)}
                          title="Company detail"
                          aria-label="Company detail"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full"
                          onClick={() => startRenewal(item)}
                          disabled={renewingId === item.id}
                          title="Renew (quotation)"
                          aria-label="Renew domain"
                        >
                          {renewingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-emerald-600 rounded-full"
                          onClick={() => openEditDomain(item)}
                          aria-label="Edit domain"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => setDeleteConfirmDomain(item)}
                          disabled={deleteDomainMutation.isPending}
                          aria-label="Delete domain"
                        >
                          {deleteDomainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDomains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-slate-500 dark:text-zinc-400">No domains found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4 border-t flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 dark:border-zinc-800 no-print">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
              Show
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
              entries
              <span className="ml-3">
                {filteredDomains.length === 0
                  ? "Showing 0 entries"
                  : `Showing ${pageStart + 1} to ${pageStart + pagedDomains.length} of ${filteredDomains.length.toLocaleString()} entries`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              {pageButtons.map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} className="px-2 self-center text-slate-400">…</span>
                ) : (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === currentPage ? "default" : "outline"}
                    className={n === currentPage ? "bg-emerald-600 hover:bg-emerald-700 min-w-8" : "min-w-8"}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      {/* Add / Edit Domain Dialog */}
      <Dialog open={domainDialogOpen} onOpenChange={(open) => { setDomainDialogOpen(open); if (!open) setDomainFormError(null); }}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-zinc-900 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editingDomainId ? "Edit Domain" : "Add Domain"}</DialogTitle>
            <DialogDescription>Fill in the domain hosting details below.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 text-slate-800 dark:text-zinc-100">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="domain-company">Company</Label>
              <Select
                value={domainForm.customerId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="domain-company" className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Select a company (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {editingCompanyLabel && (
                    <SelectItem value={domainForm.customerId}>{editingCompanyLabel}</SelectItem>
                  )}
                  {customersList.map((c: any) => c && (
                    <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="domain-name">Domain Name <span className="text-red-500">*</span></Label>
              <Input
                id="domain-name"
                placeholder="example.com"
                value={domainForm.domainName}
                onChange={(e) => setDomainForm((f) => ({ ...f, domainName: e.target.value }))}
                className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-registry">Registry</Label>
              <Select
                value={domainForm.registryId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, registryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="domain-registry" className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {registries.map((r: any) => r && r.id && (
                    <SelectItem key={r.id} value={r.id}>{r.name || r.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-server">Hosting Server</Label>
              <Select
                value={domainForm.serverId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, serverId: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="domain-server" className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {servers.map((s: any) => s && s.id && (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-package">Hosting Package</Label>
              <Select
                value={domainForm.hostingPackageId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, hostingPackageId: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="domain-package" className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {hostingPackages.map((p: any) => p && p.id && (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-cpanel">cPanel Username</Label>
              <Input
                id="domain-cpanel"
                placeholder="Username (optional)"
                value={domainForm.cpanelUsername}
                onChange={(e) => setDomainForm((f) => ({ ...f, cpanelUsername: e.target.value }))}
                className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-activation">Activation Date</Label>
              <Input
                id="domain-activation"
                type="date"
                value={domainForm.activationDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, activationDate: e.target.value }))}
                className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-expiry">Expiry Date</Label>
              <Input
                id="domain-expiry"
                type="date"
                value={domainForm.expiryDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            {domainFormError && (
              <p className="col-span-2 text-xs font-semibold text-red-600 dark:text-red-400 mt-2">{domainFormError}</p>
            )}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)} disabled={saveDomainMutation.isPending}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitDomainForm} disabled={saveDomainMutation.isPending}>
              {saveDomainMutation.isPending ? "Saving..." : editingDomainId ? "Save Changes" : "Add Domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Card>

      <AlertDialog open={!!deleteConfirmDomain} onOpenChange={(open) => !open && setDeleteConfirmDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the domain <strong>{deleteConfirmDomain?.domainName || deleteConfirmDomain?.domain}</strong> and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmDomain) {
                  deleteDomainMutation.mutate(deleteConfirmDomain.id);
                  setDeleteConfirmDomain(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
