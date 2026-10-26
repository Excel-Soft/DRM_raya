"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { apiRequestJson, queryClient } from "@/lib/query/query-client";
import { buildDomainTableColumns } from "@/modules/domain-hosting/domain-hosting-table-columns";
import { DhSearchInput, DhSectionToolbar, DrmSection } from "@/modules/domain-hosting/domain-hosting-ui";
import {
  DOMAIN_HOSTNAME_RE,
  DhExportToolbar,
  DomainFormDialog,
  EMPTY_DOMAIN_FORM,
  extractDhError,
  fmtDhDate,
  type DomainFormState,
  type DomainRow,
} from "@/modules/domain-hosting/domain-hosting-shared";
import { utils, writeFile } from "xlsx";

export function ItDomainsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: domains = [], isLoading } = useQuery<DomainRow[]>({
    queryKey: ["/api/it/domains"],
  });
  const { data: servers = [] } = useQuery<{ id: string; name?: string }[]>({
    queryKey: ["/api/it/servers"],
  });
  const { data: registries = [] } = useQuery<{ id: string; name?: string }[]>({
    queryKey: ["/api/it/registries"],
  });
  const { data: hostingPackages = [] } = useQuery<{ id: string; name?: string }[]>({
    queryKey: ["/api/it/hosting-packages"],
  });
  const { data: customersResp } = useQuery<{ customers: { id: string; companyName?: string; accountName?: string; name?: string; email?: string }[] }>({
    queryKey: ["/api/customers", "domain-picker"],
    queryFn: () => apiRequestJson("GET", "/api/customers?pageSize=200"),
  });
  const customersList = Array.isArray(customersResp?.customers) ? customersResp!.customers : [];

  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [domainForm, setDomainForm] = useState<DomainFormState>(EMPTY_DOMAIN_FORM);
  const [domainFormError, setDomainFormError] = useState<string | null>(null);
  const [deleteConfirmDomain, setDeleteConfirmDomain] = useState<DomainRow | null>(null);

  const saveDomainMutation = useMutation({
    mutationFn: async (payload: { id: string | null; body: Record<string, unknown> }) => {
      if (payload.id) return apiRequestJson("PATCH", `/api/it/domains/${payload.id}`, payload.body);
      return apiRequestJson("POST", "/api/it/domains", payload.body);
    },
    onSuccess: () => {
      toast({ title: editingDomainId ? "Domain updated" : "Domain added" });
      void queryClient.invalidateQueries({ queryKey: ["/api/it/domains"] });
      setDomainDialogOpen(false);
      setDomainForm(EMPTY_DOMAIN_FORM);
      setDomainFormError(null);
    },
    onError: (err) => {
      const msg = extractDhError(err, "Failed to save domain");
      setDomainFormError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/it/domains/${id}`),
    onSuccess: () => {
      toast({ title: "Domain deleted" });
      void queryClient.invalidateQueries({ queryKey: ["/api/it/domains"] });
    },
    onError: (err) => toast({ title: extractDhError(err, "Failed to delete domain"), variant: "destructive" }),
  });

  const openCreateDomain = () => {
    setEditingDomainId(null);
    setDomainForm(EMPTY_DOMAIN_FORM);
    setDomainFormError(null);
    setDomainDialogOpen(true);
  };

  const openEditDomain = (item: DomainRow) => {
    setEditingDomainId(item.id);
    const dateToYMD = (d: string | null | undefined) => {
      if (!d) return "";
      const date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    };
    setDomainForm({
      customerId: (item as { customerId?: string }).customerId ?? "",
      domainName: item.domainName ?? item.domain ?? "",
      registryId: (item as { registryId?: string }).registryId ?? "",
      serverId: (item as { serverId?: string }).serverId ?? "",
      hostingPackageId: (item as { hostingPackageId?: string }).hostingPackageId ?? "",
      activationDate: dateToYMD((item as { activationDate?: string }).activationDate),
      expiryDate: dateToYMD(item.expiryDate),
      cpanelUsername: (item as { cpanelUsername?: string }).cpanelUsername ?? "",
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
    const body: Record<string, unknown> = { domainName };
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
  const filteredDomains = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return domainsList;
    return domainsList.filter((d) => (d.domainName || d.domain || "").toLowerCase().includes(q));
  }, [domainsList, searchTerm]);

  const exportRows = () =>
    filteredDomains.map((d, i) => ({
      No: i + 1,
      Company: d.company || "N/A",
      Domain: d.domainName || d.domain || "",
      "Domain Expiry": fmtDhDate(d.expiryDate),
      "Hosting Expiry": fmtDhDate(d.hostingExpiryDate),
      "SSL Expiry": fmtDhDate(d.sslExpiryDate),
      Registered: fmtDhDate(d.createdAt),
    }));

  const handleExport = (type: "Copy" | "Excel" | "CSV" | "Print") => {
    if (type !== "Print" && filteredDomains.length === 0) {
      toast({ title: "No data to export" });
      return;
    }
    switch (type) {
      case "Copy": {
        const text = filteredDomains
          .map((d) => `${d.company || "N/A"}\t${d.domainName || d.domain}\t${fmtDhDate(d.expiryDate)}`)
          .join("\n");
        void navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
        break;
      }
      case "Print":
        window.print();
        break;
      case "Excel": {
        const ws = utils.json_to_sheet(exportRows());
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Domains");
        writeFile(wb, "it_domains.xlsx");
        break;
      }
      case "CSV": {
        const data = exportRows();
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const lines = [
          headers.join(","),
          ...data.map((row) =>
            headers.map((h) => `"${String((row as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(","),
          ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "it_domains.csv";
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
    }
  };

  const columns = useMemo(
    () =>
      buildDomainTableColumns({
        rows: filteredDomains,
        onCopied: () => toast({ title: "Message copied" }),
        onEdit: openEditDomain,
        onDelete: setDeleteConfirmDomain,
        deletePending: deleteDomainMutation.isPending,
      }),
    [filteredDomains, toast, deleteDomainMutation.isPending],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 print:p-0">
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>

      <DrmSection
        title="Domain list"
        description={`${filteredDomains.length} domain${filteredDomains.length === 1 ? "" : "s"}`}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={openCreateDomain}>
            <Plus className="h-4 w-4" />
            Add domain
          </Button>
        }
      >
        <DhSectionToolbar
          leading={
            <DhSearchInput
              id="dh-domains-search"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Filter by domain…"
              className="print:hidden"
            />
          }
          trailing={<div className="print:hidden"><DhExportToolbar onExport={handleExport} /></div>}
        />
        <DataTable
          columns={columns}
          rows={filteredDomains}
          rowKey={(row) => row.id}
          emptyMessage="No domains match this filter."
          className="min-w-[960px]"
        />
      </DrmSection>

      <DomainFormDialog
        open={domainDialogOpen}
        onOpenChange={(open) => {
          setDomainDialogOpen(open);
          if (!open) setDomainFormError(null);
        }}
        editing={!!editingDomainId}
        form={domainForm}
        setForm={setDomainForm}
        error={domainFormError}
        pending={saveDomainMutation.isPending}
        customers={customersList}
        registries={registries}
        servers={servers}
        hostingPackages={hostingPackages}
        onSubmit={submitDomainForm}
      />

      <AlertDialog open={!!deleteConfirmDomain} onOpenChange={(open) => !open && setDeleteConfirmDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this domain?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes <strong>{deleteConfirmDomain?.domainName || deleteConfirmDomain?.domain}</strong>.
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
