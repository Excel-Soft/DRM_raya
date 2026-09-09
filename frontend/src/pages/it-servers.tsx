import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequestJson } from "@/lib/queryClient";
import { Loader2, Search, User, RefreshCw, Plus, Server, Database, Trash2, Globe, HardDrive, Pencil, AlertCircle, Copy, FileText, Download, Printer, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { utils, writeFile } from "xlsx";

const SERVER_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;

function normalizeStatusLabel(status: unknown): string {
  const s = String(status ?? "").trim().toUpperCase();
  return (SERVER_STATUS_OPTIONS as readonly string[]).includes(s) ? s : "ACTIVE";
}

function statusBadgeClass(status: string): string {
  switch (normalizeStatusLabel(status)) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "INACTIVE":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "SUSPENDED":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "ARCHIVED":
      return "bg-red-50 text-red-700 border-red-100";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// Mutation errors thrown by apiRequestJson look like: `409: {"error":"..."}`.
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

interface ServerForm {
  name: string;
  host: string;
  provider: string;
  status: string;
  notes: string;
}

const EMPTY_SERVER_FORM: ServerForm = {
  name: "",
  host: "",
  provider: "",
  status: "ACTIVE",
  notes: "",
};

// Patch 6 Stage 6 — controlled domain create form. Only fields that map to real
// it_domains columns are captured. The cPanel PASSWORD is intentionally omitted:
// it is a plaintext-only column and the stage forbids storing plaintext secrets.
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

const fmtDate = (d: string | null | undefined) =>
  d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString() : "N/A";

function expiryStatus(dateStr: string | null | undefined): { label: string; cls: string } {
  if (!dateStr || isNaN(new Date(dateStr).getTime())) {
    return { label: "N/A", cls: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" };
  }
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (days <= 30) return { label: `${days}d left`, cls: "bg-emerald-100 text-emerald-700" }; // normal active status or warning
  return { label: "Active", cls: "bg-emerald-100 text-emerald-700" };
}

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

function customerLabel(c: any): string {
  return c?.companyName || c?.accountName || c?.name || c?.email || c?.id || "Unknown";
}

export default function ItServers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(true);
  const { toast } = useToast();

  // --- Server Names management state ---
  const [serverSearch, setServerSearch] = useState("");
  const [serverStatusFilter, setServerStatusFilter] = useState<string>("ALL");
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState<ServerForm>(EMPTY_SERVER_FORM);
  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<any | null>(null);

  // --- Domain Hosting create form state (Patch 6 Stage 6) ---
  const [domainForm, setDomainForm] = useState<DomainForm>(EMPTY_DOMAIN_FORM);
  const [domainFormError, setDomainFormError] = useState<string | null>(null);

  // --- Registry / Hosting Package inline create state ---
  const [registryName, setRegistryName] = useState("");
  const [registryUrl, setRegistryUrl] = useState("");
  const [pkgName, setPkgName] = useState("");
  const [pkgCapacity, setPkgCapacity] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");

  const {
    data: servers = [],
    isLoading,
    isError: serversError,
    refetch: refetchServers,
    isFetching: serversFetching,
  } = useQuery<any[]>({
    queryKey: ["/api/it/servers"],
  });

  const { data: registries = [] } = useQuery<any[]>({
    queryKey: ["/api/it/registries"],
  });

  const { data: hostingPackages = [] } = useQuery<any[]>({
    queryKey: ["/api/it/hosting-packages"],
  });

  const { data: domains = [] } = useQuery<any[]>({
    queryKey: ["/api/it/domains"],
  });

  // NOTE: all hooks (incl. mutations) must run before any conditional early
  // return, otherwise the hook count changes between renders once isLoading
  // flips false -> React "Rendered more hooks than during the previous render".
  const deleteServerMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/it/servers/${id}`),
    onSuccess: () => {
      toast({ title: "Server archived" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/servers"] });
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to delete server"), variant: "destructive" })
  });

  const deleteRegistryMutation = useMutation({
    // apiRequestJson throws on a non-2xx so a 403/404 surfaces honestly instead
    // of showing a false "deleted" toast.
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/it/registries/${id}`),
    onSuccess: () => {
      toast({ title: "Registry deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/registries"] });
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to delete registry"), variant: "destructive" })
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/it/hosting-packages/${id}`),
    onSuccess: () => {
      toast({ title: "Hosting package deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/hosting-packages"] });
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to delete package"), variant: "destructive" })
  });

  const saveServerMutation = useMutation({
    mutationFn: async (payload: { id: string | null; body: Record<string, any> }) => {
      if (payload.id) {
        return apiRequestJson("PATCH", `/api/it/servers/${payload.id}`, payload.body);
      }
      return apiRequestJson("POST", "/api/it/servers", payload.body);
    },
    onSuccess: (_data, vars) => {
      toast({ title: vars.id ? "Server updated" : "Server added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/servers"] });
      setServerDialogOpen(false);
      setServerFormError(null);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err, "Failed to save server");
      setServerFormError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  const serverStatusMutation = useMutation({
    mutationFn: async (payload: { id: string; status: string }) =>
      apiRequestJson("PATCH", `/api/it/servers/${payload.id}/status`, { status: payload.status }),
    onSuccess: () => {
      toast({ title: "Server status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/servers"] });
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to update status"), variant: "destructive" }),
  });

  // FK-safe customer picker source. /api/customers returns { customers: [...] }
  // with real customer rows (the search endpoint can yield synthetic ids that
  // break the it_domains.customer_id FK), so we load real rows here. The default
  // queryFn joins the key into the URL, so we supply a custom queryFn for params.
  const { data: customersResp } = useQuery<{ customers: any[] }>({
    queryKey: ["/api/customers", "domain-picker"],
    queryFn: () => apiRequestJson("GET", "/api/customers?pageSize=200"),
  });
  const customersList = Array.isArray(customersResp?.customers) ? customersResp!.customers : [];

  const saveDomainMutation = useMutation({
    mutationFn: async (body: Record<string, any>) =>
      apiRequestJson("POST", "/api/it/domains", body),
    onSuccess: () => {
      toast({ title: "Domain added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/domains"] });
      setDomainForm(EMPTY_DOMAIN_FORM);
      setDomainFormError(null);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err, "Failed to save domain");
      setDomainFormError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  const createRegistryMutation = useMutation({
    mutationFn: async (body: Record<string, any>) =>
      apiRequestJson("POST", "/api/it/registries", body),
    onSuccess: () => {
      toast({ title: "Registry added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/registries"] });
      setRegistryName("");
      setRegistryUrl("");
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to add registry"), variant: "destructive" }),
  });

  const createPackageMutation = useMutation({
    mutationFn: async (body: Record<string, any>) =>
      apiRequestJson("POST", "/api/it/hosting-packages", body),
    onSuccess: () => {
      toast({ title: "Hosting package added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/hosting-packages"] });
      setPkgName("");
      setPkgCapacity("");
      setPkgPrice("");
    },
    onError: (err) =>
      toast({ title: extractErrorMessage(err, "Failed to add package"), variant: "destructive" }),
  });

  const openCreateServer = () => {
    setEditingServerId(null);
    setServerForm(EMPTY_SERVER_FORM);
    setServerFormError(null);
    setServerDialogOpen(true);
  };

  const openEditServer = (server: any) => {
    setEditingServerId(server.id);
    setServerForm({
      name: server.name ?? "",
      host: server.ip ?? "",
      provider: server.provider ?? "",
      status: normalizeStatusLabel(server.status),
      notes: server.notes ?? "",
    });
    setServerFormError(null);
    setServerDialogOpen(true);
  };

  const submitServerForm = () => {
    const name = serverForm.name.trim();
    const host = serverForm.host.trim();
    if (!name) {
      setServerFormError("Server name is required");
      return;
    }
    if (!host) {
      setServerFormError("Host / IP is required");
      return;
    }
    setServerFormError(null);
    saveServerMutation.mutate({
      id: editingServerId,
      body: {
        name,
        ip: host,
        provider: serverForm.provider.trim() || null,
        notes: serverForm.notes.trim() || null,
        status: serverForm.status,
      },
    });
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
    if (domainForm.customerId) body.customerId = domainForm.customerId;
    if (domainForm.registryId) body.registryId = domainForm.registryId;
    if (domainForm.serverId) body.serverId = domainForm.serverId;
    if (domainForm.hostingPackageId) body.hostingPackageId = domainForm.hostingPackageId;
    if (domainForm.activationDate) body.activationDate = domainForm.activationDate;
    if (domainForm.expiryDate) body.expiryDate = domainForm.expiryDate;
    if (domainForm.cpanelUsername.trim()) body.cpanelUsername = domainForm.cpanelUsername.trim();
    saveDomainMutation.mutate(body);
  };

  const submitRegistry = () => {
    const name = registryName.trim();
    if (!name) {
      toast({ title: "Registry name is required", variant: "destructive" });
      return;
    }
    createRegistryMutation.mutate({ name, url: registryUrl.trim() || undefined });
  };

  const submitPackage = () => {
    const name = pkgName.trim();
    if (!name) {
      toast({ title: "Package name is required", variant: "destructive" });
      return;
    }
    const body: Record<string, any> = { name };
    if (pkgCapacity.trim()) body.capacity = pkgCapacity.trim();
    if (pkgPrice.trim()) body.price = pkgPrice.trim();
    createPackageMutation.mutate(body);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const serversList = Array.isArray(servers) ? servers : []; const registriesList = Array.isArray(registries) ? registries : []; const hostingPackagesList = Array.isArray(hostingPackages) ? hostingPackages : []; const domainsList = Array.isArray(domains) ? domains : []; const filteredDomains = domainsList.filter(d => 
    d && (d.domainName || d.domain || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const serverSearchLc = serverSearch.trim().toLowerCase();
  const filteredServers = serversList.filter((s: any) => {
    if (!s) return false;
    if (serverStatusFilter !== "ALL" && normalizeStatusLabel(s.status) !== serverStatusFilter) return false;
    if (!serverSearchLc) return true;
    const hay = `${s.name || ""} ${s.ip || ""} ${s.provider || ""}`.toLowerCase();
    return hay.includes(serverSearchLc);
  });

  const exportServerRows = () =>
    filteredServers.map((s: any, i: number) => ({
      No: i + 1,
      Name: s.name || "",
      HostIP: s.ip || "",
      Provider: s.provider || "—",
      Status: s.status || "ACTIVE",
      "Created At": s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—",
    }));

  const exportServersToCSV = () => {
    const data = exportServerRows();
    if (data.length === 0) return;
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
    link.setAttribute("download", "it_servers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportServersToExcel = () => {
    const ws = utils.json_to_sheet(exportServerRows());
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Servers");
    writeFile(wb, "it_servers.xlsx");
  };

  const handleServerExport = (type: string) => {
    if (type !== "Print" && filteredServers.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    switch (type) {
      case "Copy": {
        const text = filteredServers
          .map((s: any) => `${s.name || ""}\t${s.ip || ""}\t${s.provider || "—"}\t${s.status || "ACTIVE"}`)
          .join("\n");
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Server data copied to clipboard" });
        break;
      }
      case "Print":
        window.print();
        break;
      case "Excel":
        exportServersToExcel();
        break;
      case "CSV":
        exportServersToCSV();
        break;
    }
  };

  const serverExportButtons = [
    { label: "Copy", icon: Copy },
    { label: "Excel", icon: Download },
    { label: "CSV", icon: FileText },
    { label: "Print", icon: Printer },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen dark:bg-zinc-950">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 
          className="text-2xl font-bold tracking-tight text-slate-800 cursor-pointer select-none flex items-center gap-3 group dark:text-zinc-100"
          onClick={() => setIsFormVisible(!isFormVisible)}
        >
          ADD SERVER / <span className="text-emerald-600">ADD DOMAIN</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity dark:text-zinc-400 dark:bg-zinc-900">
            {isFormVisible ? "Click to hide" : "Click to show"}
          </span>
        </h1>
      </div>

      {/* Main Form Card */}
      {isFormVisible && (
        <Card className="border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
        <CardContent className="p-6 dark:bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Row 1 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Company</label>
              <Select
                value={domainForm.customerId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Select a company (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {customersList.map((c: any) => c && (
                    <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Domain Name<span className="text-red-500">*</span></label>
              <Input
                placeholder="example.com"
                value={domainForm.domainName}
                onChange={(e) => setDomainForm((f) => ({ ...f, domainName: e.target.value }))}
                className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Registry</label>
              <Select
                value={domainForm.registryId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, registryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {registriesList.map((r: any) => r && r.id && (
                    <SelectItem key={r.id} value={r.id}>{r.name || r.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Hosting Server</label>
              <Select
                value={domainForm.serverId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, serverId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {serversList.map((s: any) => s && s.id && (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Hosting Package</label>
              <Select
                value={domainForm.hostingPackageId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, hostingPackageId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {hostingPackagesList.map((p: any) => p && p.id && (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">cPanel Username</label>
              <Input
                placeholder="Enter username (optional)"
                value={domainForm.cpanelUsername}
                onChange={(e) => setDomainForm((f) => ({ ...f, cpanelUsername: e.target.value }))}
                className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Row 3 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Activation Date</label>
              <Input
                type="date"
                value={domainForm.activationDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, activationDate: e.target.value }))}
                className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Expiry Date</label>
              <Input
                type="date"
                value={domainForm.expiryDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="h-11 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>
          </div>

          {domainFormError && (
            <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{domainFormError}</p>
          )}

          <div className="mt-8">
            <Button
              onClick={submitDomainForm}
              disabled={saveDomainMutation.isPending}
              className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all"
            >
              {saveDomainMutation.isPending ? "Saving..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Table Section */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between bg-white dark:bg-zinc-900 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Show</span>
              <Select defaultValue="10">
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500 dark:text-zinc-400">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Search:</span>
              <Input className="h-8 w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
              {filteredDomains.map((item: any, idx: number) => item && (
                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                  <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{idx + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-700 dark:text-zinc-400">{item.company || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors">
                      {item.domainName || item.domain}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-white leading-none px-1.5 py-0.5">Renew</Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{item.hostingExpiryDate ? new Date(item.hostingExpiryDate).toLocaleDateString() : "N/A"}</div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-white leading-none px-1.5 py-0.5">Renew</Badge>
                  </TableCell>
                  <TableCell>
                    {item.ssl && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm dark:text-zinc-300">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full">
                          <User className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] w-[1200px] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-[#f8f9fa] dark:bg-zinc-900">
                        <DialogHeader className="p-4 bg-white dark:bg-zinc-900 border-b flex flex-row items-center justify-between space-y-0">
                          <DialogTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">Attribute</DialogTitle>
                        </DialogHeader>
                        <div className="p-6 overflow-y-auto max-h-[85vh]">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            {/* Left Column: Client Info */}
                            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                              <CardContent className="p-6 flex flex-col items-center text-center">
                                <h3 className="font-bold text-slate-800 text-lg mb-2 dark:text-zinc-100">{item.company || "N/A"}</h3>
                                <div className="h-12 w-12 rounded-full bg-blue-100/50 flex items-center justify-center text-blue-600 font-bold text-xl mb-4">
                                  {(item.company || "N").charAt(0)}
                                </div>
                                <h4 className="font-bold text-slate-700 dark:text-zinc-400">Client Contact</h4>
                                <p className="text-xs text-slate-400 mb-4">{item.email || "N/A"}</p>

                                <div className="flex gap-2 mb-6">
                                  <Badge className="bg-emerald-600 hover:bg-emerald-600 px-3 py-1 text-[10px] font-bold">{item.contactNo || "N/A"}</Badge>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Middle Column: Expiry History */}
                            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                              <CardContent className="p-6">
                                <h3 className="font-bold text-slate-700 text-sm mb-6 flex items-center gap-2 dark:text-zinc-400">
                                  Expiry Date
                                </h3>
                                <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                                  <div className="flex gap-4 relative">
                                    <div className="h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 flex items-center justify-center z-10 shrink-0 mt-1 dark:border-zinc-800">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                          <Globe className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-400">Domain</p>
                                          <p className="text-[10px] text-slate-400 italic font-mono">{item.domainName || item.domain}</p>
                                        </div>
                                      </div>
                                      <Badge className="bg-slate-800 text-white font-mono text-[9px] w-fit">Exp: {fmtDate(item.expiryDate)}</Badge>
                                    </div>
                                  </div>

                                  <div className="flex gap-4 relative">
                                    <div className="h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 flex items-center justify-center z-10 shrink-0 mt-1 dark:border-zinc-800">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                          <ShieldCheck className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-400">SSL</p>
                                          <p className="text-[10px] text-slate-400 italic font-mono">{item.domainName || item.domain}</p>
                                        </div>
                                      </div>
                                      <Badge className="bg-slate-800 text-white font-mono text-[9px] w-fit">Exp: {fmtDate(item.sslExpiryDate)}</Badge>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Right Column: Message composer */}
                            <div className="space-y-6">
                              <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                                <CardContent className="p-6">
                                  <h3 className="font-bold text-slate-700 text-sm mb-4 dark:text-zinc-400">Renewal Message</h3>
                                  <MessageComposer
                                    item={item}
                                    onCopied={() => toast({ title: "Copied!", description: "Message copied to clipboard" })}
                                  />
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] w-[1200px] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-[#f8f9fa] dark:bg-zinc-900">
                        <DialogHeader className="p-4 bg-white dark:bg-zinc-900 border-b">
                          <div className="flex items-center gap-2">
                            <DialogTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider dark:text-zinc-400">Quotation</DialogTitle>
                            <span className="text-xs font-bold text-emerald-500">{new Date().toLocaleString()}</span>
                          </div>
                        </DialogHeader>
                        <div className="p-6 overflow-y-auto max-h-[85vh]">
                          <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden p-6 mb-6 text-slate-800 dark:text-zinc-100">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase dark:text-zinc-400">Company</label>
                                <Input value={item.company || "N/A"} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800" />
                              </div>
                            </div>
                            <Table>
                              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                                <TableRow>
                                  <TableHead className="text-xs font-bold">Product</TableHead>
                                  <TableHead className="text-xs font-bold">Detail</TableHead>
                                  <TableHead className="text-xs font-bold text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-xs">Domain Renewal</TableCell>
                                  <TableCell className="text-xs">{item.domainName || item.domain}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">$15.00</TableCell>
                                </TableRow>
                                {item.hostingPackageName && (
                                  <TableRow>
                                    <TableCell className="text-xs">Hosting Package ({item.hostingPackageName})</TableCell>
                                    <TableCell className="text-xs">Capacity: {item.capacity || item.hostingPackageCapacity || "N/A"}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">
                                      ${item.hostingPackagePrice ? parseFloat(item.hostingPackagePrice).toFixed(2) : "0.00"}
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="border-t font-bold">
                                  <TableCell className="text-xs">Total Renewal Amount</TableCell>
                                  <TableCell className="text-xs"></TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    ${(15.00 + (item.hostingPackagePrice ? parseFloat(item.hostingPackagePrice) : 0)).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </Card>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDomains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-slate-500 dark:text-zinc-400">No domains found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4 border-t flex items-center justify-between bg-white dark:bg-zinc-900 dark:bg-zinc-900">
            <span className="text-sm text-slate-500 dark:text-zinc-400">Showing {filteredDomains.length} entries</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">1</Button>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Names Management */}
      <Card className="border-none shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader className="bg-emerald-600 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-white" /> Server Names
          </CardTitle>
          <Button size="sm" variant="secondary" className="h-8 bg-white text-emerald-700 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-zinc-800" onClick={openCreateServer}>
            <Plus className="h-4 w-4 mr-1" /> Add Server
          </Button>
        </CardHeader>
        <CardContent className="p-0 bg-white dark:bg-zinc-900">
          {/* Toolbar: search + status filter + refresh */}
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between dark:border-zinc-800">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search name, host, provider" className="pl-10 h-9" value={serverSearch} onChange={(e) => setServerSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5">
                {serverExportButtons.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <Button
                      key={btn.label}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 flex items-center gap-1.5"
                      onClick={() => handleServerExport(btn.label)}
                    >
                      <Icon className="h-4 w-4" /> {btn.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-zinc-400">Status</span>
              <Select value={serverStatusFilter} onValueChange={setServerStatusFilter}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {SERVER_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={() => refetchServers()} disabled={serversFetching}>
                <RefreshCw className={`h-4 w-4 ${serversFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {serversError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-slate-600 dark:text-zinc-300">Could not load servers.</p>
              <Button variant="outline" size="sm" onClick={() => refetchServers()}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                <TableRow>
                  <TableHead className="w-12 font-bold text-slate-700 dark:text-zinc-400">No</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Server Name</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Host / IP</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Provider</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                  <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServers.map((server: any, idx: number) => server && (
                  <TableRow key={server.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800">
                    <TableCell className="text-slate-500 font-medium dark:text-zinc-400">{idx + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-700 dark:text-zinc-100">{server.name}</TableCell>
                    <TableCell className="text-slate-600 dark:text-zinc-300">{server.ip}</TableCell>
                    <TableCell className="text-slate-600 dark:text-zinc-300">{server.provider || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusBadgeClass(server.status)}>{normalizeStatusLabel(server.status)}</Badge>
                        <Select value={normalizeStatusLabel(server.status)} onValueChange={(val) => serverStatusMutation.mutate({ id: server.id, status: val })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SERVER_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-emerald-600" onClick={() => openEditServer(server)} aria-label="Edit server">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteConfirmServer(server)} disabled={deleteServerMutation.isPending} aria-label="Delete server">
                          {deleteServerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredServers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-500 dark:text-zinc-400">
                      {serversList.length === 0 ? 'No servers yet. Click "Add Server" to create one.' : "No servers match your search."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <div className="p-3 border-t text-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">Showing {filteredServers.length} of {serversList.length} servers</div>
        </CardContent>
      </Card>

      {/* Bottom Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registry List */}
        <Card className="border-none shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader className="bg-slate-50 dark:bg-zinc-800 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white dark:bg-zinc-900">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" /> Add Registry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-zinc-900 flex-1 text-white dark:bg-zinc-900">
            <div className="flex flex-col gap-2 mb-4 sm:flex-row">
              <Input
                value={registryName}
                onChange={(e) => setRegistryName(e.target.value)}
                placeholder="Registry name *"
                className="h-9 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              />
              <Input
                value={registryUrl}
                onChange={(e) => setRegistryUrl(e.target.value)}
                placeholder="URL (optional)"
                className="h-9 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              />
              <Button
                onClick={submitRegistry}
                disabled={createRegistryMutation.isPending}
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {createRegistryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <div className="space-y-3">
              {registriesList.map((reg: any, i: number) => reg && (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 dark:border-zinc-800">
                  <span className="text-[13px] font-medium text-slate-700 dark:text-zinc-400">{reg.name || reg}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRegistryMutation.mutate(reg.id)} disabled={deleteRegistryMutation.isPending}>
                    {deleteRegistryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
              {registriesList.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">No registries listed</div>}
            </div>
          </CardContent>
        </Card>

        {/* Hosting Packages */}
        <Card className="border-none shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader className="bg-emerald-600 py-3 px-4 flex flex-row items-center justify-between space-y-0 text-white">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-white" /> Add Hosting Pkg
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white dark:bg-zinc-900 flex-1 text-white dark:bg-zinc-900">
            <div className="flex flex-col gap-2 mb-4">
              <Input
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Package name *"
                className="h-9 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              />
              <div className="flex gap-2">
                <Input
                  value={pkgCapacity}
                  onChange={(e) => setPkgCapacity(e.target.value)}
                  placeholder="Capacity (optional)"
                  className="h-9 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(e.target.value)}
                  placeholder="Price (optional)"
                  className="h-9 bg-slate-50/50 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                />
                <Button
                  onClick={submitPackage}
                  disabled={createPackageMutation.isPending}
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  {createPackageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {hostingPackagesList.map((pkg: any, i: number) => pkg && (
                <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-slate-50 last:border-0 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-zinc-100">{pkg.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deletePackageMutation.mutate(pkg.id)} disabled={deletePackageMutation.isPending}>
                      {deletePackageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">Capacity: {pkg.capacity || "N/A"}</span>
                </div>
              ))}
              {hostingPackagesList.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">No packages listed</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Server Dialog */}
      <Dialog open={serverDialogOpen} onOpenChange={(open) => { setServerDialogOpen(open); if (!open) setServerFormError(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingServerId ? "Edit Server" : "Add Server"}</DialogTitle>
            <DialogDescription>Server names are shared with the domain hosting records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="server-name">Server Name <span className="text-red-500">*</span></Label>
              <Input id="server-name" value={serverForm.name} onChange={(e) => setServerForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Web Server 01" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server-host">Host / IP <span className="text-red-500">*</span></Label>
              <Input id="server-host" value={serverForm.host} onChange={(e) => setServerForm((f) => ({ ...f, host: e.target.value }))} placeholder="host.example.com or 192.168.1.10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server-provider">Provider</Label>
              <Input id="server-provider" value={serverForm.provider} onChange={(e) => setServerForm((f) => ({ ...f, provider: e.target.value }))} placeholder="e.g. GoDaddy" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server-status">Status</Label>
              <Select value={serverForm.status} onValueChange={(val) => setServerForm((f) => ({ ...f, status: val }))}>
                <SelectTrigger id="server-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVER_STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server-notes">Notes</Label>
              <Textarea id="server-notes" value={serverForm.notes} onChange={(e) => setServerForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} />
            </div>
            {serverFormError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {serverFormError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServerDialogOpen(false)} disabled={saveServerMutation.isPending}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitServerForm} disabled={saveServerMutation.isPending}>
              {saveServerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingServerId ? "Save Changes" : "Add Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmServer} onOpenChange={(open) => !open && setDeleteConfirmServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently archive the server <strong>{deleteConfirmServer?.name}</strong> and soft delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmServer) {
                  deleteServerMutation.mutate(deleteConfirmServer.id);
                  setDeleteConfirmServer(null);
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
