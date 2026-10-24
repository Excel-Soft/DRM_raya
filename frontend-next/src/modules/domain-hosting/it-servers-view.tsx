"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/query/query-client";
import { Loader2, RefreshCw, Plus, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/legacy/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/legacy/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { utils, writeFile } from "xlsx";
import { DhExportToolbar, customerLabel } from "@/modules/domain-hosting/domain-hosting-shared";
import { buildDomainTableColumns, buildServerTableColumns } from "@/modules/domain-hosting/domain-hosting-table-columns";
import {
  DhFormGrid,
  DhResourceList,
  DhSearchInput,
  DhSectionToolbar,
  DrmFormActions,
  DrmInlineActions,
  DrmSection,
  dhDialogShellClass,
  dhSelectTriggerClass,
  drmFieldClass,
} from "@/modules/domain-hosting/domain-hosting-ui";
import { cn } from "@/lib/utils/cn";

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
  capacityMb: string;
  buyingDate: string;
  years: string;
}

const EMPTY_SERVER_FORM: ServerForm = {
  name: "",
  host: "",
  provider: "",
  status: "ACTIVE",
  notes: "",
  capacityMb: "",
  buyingDate: "",
  years: "",
};

const SERVER_YEAR_OPTIONS = ["1", "2", "3", "4", "5"];

function serverExpiryInfo(server: any): { label: string; cls: string } {
  if (server.daysLeft == null) {
    return { label: "N/A", cls: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" };
  }
  if (server.daysLeft < 0) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (server.daysLeft <= 30) return { label: `${server.daysLeft}d left`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${server.daysLeft}d left`, cls: "bg-emerald-100 text-emerald-700" };
}

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

export function ItServersView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormVisible, setIsFormVisible] = useState(false);
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
  const [pkgCapacityMb, setPkgCapacityMb] = useState("");
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
      setPkgCapacityMb("");
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
      capacityMb: server.capacityMb != null ? String(server.capacityMb) : "",
      buyingDate: server.buyingDate ? String(server.buyingDate).slice(0, 10) : "",
      years: server.years != null ? String(server.years) : "",
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
        capacityMb: serverForm.capacityMb.trim() ? Number(serverForm.capacityMb) : null,
        buyingDate: serverForm.buyingDate || null,
        years: serverForm.years ? Number(serverForm.years) : null,
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
    if (pkgCapacityMb.trim()) body.capacityMb = pkgCapacityMb.trim();
    if (pkgPrice.trim()) body.price = pkgPrice.trim();
    createPackageMutation.mutate(body);
  };

  const serversList = useMemo(() => (Array.isArray(servers) ? servers : []), [servers]);
  const registriesList = useMemo(() => (Array.isArray(registries) ? registries : []), [registries]);
  const hostingPackagesList = useMemo(() => (Array.isArray(hostingPackages) ? hostingPackages : []), [hostingPackages]);
  const domainsList = useMemo(() => (Array.isArray(domains) ? domains : []), [domains]);

  const filteredDomains = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return domainsList;
    return domainsList.filter(
      (d) => d && (d.domainName || d.domain || "").toLowerCase().includes(q),
    );
  }, [domainsList, searchTerm]);

  const filteredServers = useMemo(() => {
    const q = serverSearch.trim().toLowerCase();
    return serversList.filter((s: { status?: string; name?: string; ip?: string; provider?: string }) => {
      if (!s) return false;
      if (serverStatusFilter !== "ALL" && normalizeStatusLabel(s.status) !== serverStatusFilter) return false;
      if (!q) return true;
      return `${s.name || ""} ${s.ip || ""} ${s.provider || ""}`.toLowerCase().includes(q);
    });
  }, [serversList, serverSearch, serverStatusFilter]);

  const domainColumns = useMemo(
    () =>
      buildDomainTableColumns({
        rows: filteredDomains,
        onCopied: () => toast({ title: "Message copied" }),
      }),
    [filteredDomains, toast],
  );

  const serverColumns = useMemo(
    () =>
      buildServerTableColumns({
        rows: filteredServers,
        statusOptions: SERVER_STATUS_OPTIONS,
        onStatusChange: (id, status) => serverStatusMutation.mutate({ id, status }),
        onEdit: openEditServer,
        onDelete: setDeleteConfirmServer,
        deletePending: deleteServerMutation.isPending,
      }),
    [filteredServers, deleteServerMutation.isPending, serverStatusMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

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

  const formToggle = (
    <DrmInlineActions
      items={[
        {
          id: "toggle-domain-form",
          label: isFormVisible ? "Hide form" : "Register domain",
          active: isFormVisible,
          onClick: () => setIsFormVisible((v) => !v),
        },
      ]}
    />
  );

  return (
    <div className="space-y-5">
      {isFormVisible ? (
        <DrmSection title="Register domain" description="Link domain, hosting, and SSL metadata" actions={formToggle}>
          <DhFormGrid cols={3}>
            <Field id="sv-company" label="Company">
              <Select
                value={domainForm.customerId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {customersList.map((c: any) => c && (
                    <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="sv-domain" label="Domain name">
              <Input
                placeholder="example.com"
                value={domainForm.domainName}
                onChange={(e) => setDomainForm((f) => ({ ...f, domainName: e.target.value }))}
                className={drmFieldClass}
              />
            </Field>

            <Field id="sv-registry" label="Registry">
              <Select
                value={domainForm.registryId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, registryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {registriesList.map((r: any) => r && r.id && (
                    <SelectItem key={r.id} value={r.id}>{r.name || r.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="sv-server" label="Hosting server">
              <Select
                value={domainForm.serverId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, serverId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {serversList.map((s: any) => s && s.id && (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="sv-package" label="Hosting package">
              <Select
                value={domainForm.hostingPackageId || "none"}
                onValueChange={(v) => setDomainForm((f) => ({ ...f, hostingPackageId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {hostingPackagesList.map((p: any) => p && p.id && (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="sv-cpanel" label="cPanel username">
              <Input
                placeholder="Optional"
                value={domainForm.cpanelUsername}
                onChange={(e) => setDomainForm((f) => ({ ...f, cpanelUsername: e.target.value }))}
                className={drmFieldClass}
              />
            </Field>

            <Field id="sv-activation" label="Activation date">
              <Input
                type="date"
                value={domainForm.activationDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, activationDate: e.target.value }))}
                className={drmFieldClass}
              />
            </Field>

            <Field id="sv-expiry" label="Expiry date">
              <Input
                type="date"
                value={domainForm.expiryDate}
                onChange={(e) => setDomainForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className={drmFieldClass}
              />
            </Field>
          </DhFormGrid>

          {domainFormError ? <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{domainFormError}</p> : null}
          <DrmFormActions>
            <Button type="button" variant="primary" size="sm" onClick={submitDomainForm} disabled={saveDomainMutation.isPending}>
              {saveDomainMutation.isPending ? "Saving…" : "Submit domain"}
            </Button>
          </DrmFormActions>
        </DrmSection>
      ) : (
        <div className="flex justify-end">{formToggle}</div>
      )}

      <DrmSection title="Domain list" description={`${filteredDomains.length} domain${filteredDomains.length === 1 ? "" : "s"}`}>
        <DhSectionToolbar
          leading={<DhSearchInput id="sv-dom-search" value={searchTerm} onChange={setSearchTerm} placeholder="Filter domains…" />}
        />
        <DataTable
          columns={domainColumns}
          rows={filteredDomains}
          rowKey={(row) => row.id}
          emptyMessage="No domains found."
          className="min-w-[960px]"
        />
      </DrmSection>

      <DrmSection
        title="Server inventory"
        description={`${filteredServers.length} of ${serversList.length} servers`}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={openCreateServer}>
            <Plus className="h-4 w-4" />
            Add server
          </Button>
        }
      >
        <DhSectionToolbar
          leading={
            <DhSearchInput
              id="sv-server-search"
              value={serverSearch}
              onChange={setServerSearch}
              placeholder="Search servers…"
            />
          }
          trailing={
            <>
              <DhExportToolbar onExport={(t) => handleServerExport(t)} />
              <Select value={serverStatusFilter} onValueChange={setServerStatusFilter}>
                <SelectTrigger className={cn(dhSelectTriggerClass, "h-9 w-36 text-xs")}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {SERVER_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="sm" className="h-9 w-9 p-0" onClick={() => refetchServers()} disabled={serversFetching} aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${serversFetching ? "animate-spin" : ""}`} />
              </Button>
            </>
          }
        />
        <DataTable
          columns={serverColumns}
          rows={filteredServers}
          rowKey={(row) => row.id}
          loading={serversFetching && !serversError}
          error={serversError ? "Could not load servers." : null}
          onRetry={() => refetchServers()}
          emptyMessage={
            serversList.length === 0 ? 'No servers yet — use "Add server" to create one.' : "No servers match your filters."
          }
          className="min-w-[1024px]"
        />
      </DrmSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DrmSection title="Registries" description="Domain registrar list">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Input value={registryName} onChange={(e) => setRegistryName(e.target.value)} placeholder="Registry name *" className={drmFieldClass} />
              <Input value={registryUrl} onChange={(e) => setRegistryUrl(e.target.value)} placeholder="URL (optional)" className={drmFieldClass} />
              <Button type="button" variant="primary" onClick={submitRegistry} disabled={createRegistryMutation.isPending} className="shrink-0">
                {createRegistryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <DhResourceList
              emptyLabel="No registries yet."
              items={registriesList.map((reg: { id: string; name?: string }) => ({
                id: reg.id,
                title: reg.name || reg.id,
              }))}
              renderActions={(id) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => deleteRegistryMutation.mutate(id)}
                  disabled={deleteRegistryMutation.isPending}
                  aria-label="Delete registry"
                >
                  {deleteRegistryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            />
        </DrmSection>

        <DrmSection title="Hosting packages" description="Plans linked to domains">
            <div className="mb-4 flex flex-col gap-2">
              <Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder="Package name *" className={drmFieldClass} />
              <div className="flex gap-2">
                <Input value={pkgCapacity} onChange={(e) => setPkgCapacity(e.target.value)} placeholder="Capacity label" className={drmFieldClass} />
                <Input type="number" min="0" value={pkgCapacityMb} onChange={(e) => setPkgCapacityMb(e.target.value)} placeholder="MB" className={drmFieldClass} />
              </div>
              <div className="flex gap-2">
                <Input type="number" min="0" step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} placeholder="Price" className={drmFieldClass} />
                <Button type="button" variant="primary" onClick={submitPackage} disabled={createPackageMutation.isPending} className="shrink-0">
                  {createPackageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
            <DhResourceList
              emptyLabel="No hosting packages yet."
              items={hostingPackagesList.map((pkg: { id: string; name?: string; capacity?: string }) => ({
                id: pkg.id,
                title: pkg.name || pkg.id,
                subtitle: pkg.capacity ? `Capacity: ${pkg.capacity}` : undefined,
              }))}
              renderActions={(id) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => deletePackageMutation.mutate(id)}
                  disabled={deletePackageMutation.isPending}
                  aria-label="Delete package"
                >
                  {deletePackageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            />
        </DrmSection>
      </div>

      <Dialog open={serverDialogOpen} onOpenChange={(open) => { setServerDialogOpen(open); if (!open) setServerFormError(null); }}>
        <DialogContent className={cn(dhDialogShellClass, "max-w-md")}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle className="text-base font-semibold">{editingServerId ? "Edit server" : "Add server"}</DialogTitle>
            <DialogDescription>Shared with domain hosting records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="server-capacity">Space (MB)</Label>
                <Input id="server-capacity" type="number" min="0" value={serverForm.capacityMb} onChange={(e) => setServerForm((f) => ({ ...f, capacityMb: e.target.value }))} placeholder="e.g. 10000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server-buying-date">Buying Date</Label>
                <Input id="server-buying-date" type="date" value={serverForm.buyingDate} onChange={(e) => setServerForm((f) => ({ ...f, buyingDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server-years">Years</Label>
                <Select value={serverForm.years} onValueChange={(val) => setServerForm((f) => ({ ...f, years: val }))}>
                  <SelectTrigger id="server-years"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {SERVER_YEAR_OPTIONS.map((y) => (<SelectItem key={y} value={y}>{y} Year{y === "1" ? "" : "s"}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server-notes">Notes</Label>
              <Textarea id="server-notes" value={serverForm.notes} onChange={(e) => setServerForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} />
            </div>
            {serverFormError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {serverFormError}</p>
            )}
          </div>
          <DialogFooter className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <DrmFormActions>
              <Button type="button" variant="secondary" onClick={() => setServerDialogOpen(false)} disabled={saveServerMutation.isPending}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitServerForm} disabled={saveServerMutation.isPending}>
                {saveServerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingServerId ? "Save changes" : "Add server"}
              </Button>
            </DrmFormActions>
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
