"use client";

import { useState, type ReactNode } from "react";
import { Copy, Download, FileText, Globe, Printer, RefreshCw, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/legacy/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { cn } from "@/lib/utils/cn";
import {
  DhFormGrid,
  DrmFormActions,
  DrmSection,
  dhDialogShellClass,
  dhSelectTriggerClass,
  drmFieldClass,
} from "./domain-hosting-ui";

export const DOMAIN_HOSTNAME_RE =
  /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function fmtDhDate(d: string | null | undefined): string {
  if (!d || isNaN(new Date(d).getTime())) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function expiryBadgeVariant(dateStr: string | null | undefined): { label: string; variant: "neutral" | "warning" | "success" | "brand" } {
  if (!dateStr || isNaN(new Date(dateStr).getTime())) {
    return { label: "N/A", variant: "neutral" };
  }
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", variant: "warning" };
  if (days <= 30) return { label: `${days}d left`, variant: "brand" };
  return { label: "Active", variant: "success" };
}

export function extractDhError(err: unknown, fallback: string): string {
  const raw = String((err as { message?: string })?.message ?? "");
  const idx = raw.indexOf(":");
  const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not JSON */
  }
  return body || fallback;
}

export function customerLabel(c: { companyName?: string; accountName?: string; name?: string; email?: string; id?: string }): string {
  return c?.companyName || c?.accountName || c?.name || c?.email || c?.id || "Unknown";
}

export interface DomainFormState {
  customerId: string;
  domainName: string;
  registryId: string;
  serverId: string;
  hostingPackageId: string;
  activationDate: string;
  expiryDate: string;
  cpanelUsername: string;
}

export const EMPTY_DOMAIN_FORM: DomainFormState = {
  customerId: "",
  domainName: "",
  registryId: "",
  serverId: "",
  hostingPackageId: "",
  activationDate: "",
  expiryDate: "",
  cpanelUsername: "",
};

export type DomainRow = {
  id: string;
  company?: string;
  domainName?: string;
  domain?: string;
  expiryDate?: string;
  hostingExpiryDate?: string;
  sslExpiryDate?: string;
  createdAt?: string;
  email?: string;
  contactNo?: string;
  hostingPackageName?: string;
  hostingPackagePrice?: string;
  capacity?: string;
  hostingPackageCapacity?: string;
};

export function DhExportToolbar({
  onExport,
}: {
  onExport: (type: "Copy" | "Excel" | "CSV" | "Print") => void;
}) {
  const items = [
    { label: "Copy" as const, icon: Copy },
    { label: "Excel" as const, icon: Download },
    { label: "CSV" as const, icon: FileText },
    { label: "Print" as const, icon: Printer },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ label, icon: Icon }) => (
        <Button key={label} type="button" variant="secondary" size="sm" onClick={() => onExport(label)}>
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}

export function DhExpiryCell({ date }: { date?: string | null }) {
  const badge = expiryBadgeVariant(date ?? null);
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{fmtDhDate(date ?? undefined)}</div>
      <Badge variant={badge.variant} className="normal-case">
        {badge.label}
      </Badge>
    </div>
  );
}

function RenewalMessageComposer({ item, onCopied }: { item: DomainRow; onCopied: () => void }) {
  const initial =
    `Reminder for ${item.domainName || item.domain || "your domain"}:\n` +
    `Domain expiry: ${fmtDhDate(item.expiryDate)}\n` +
    `Hosting expiry: ${fmtDhDate(item.hostingExpiryDate)}\n` +
    `SSL expiry: ${fmtDhDate(item.sslExpiryDate)}\n\n` +
    `Please contact us to arrange renewal.`;
  const [msg, setMsg] = useState(initial);
  return (
    <div className="space-y-3">
      <Textarea className={cn(drmFieldClass, "min-h-[120px] resize-none")} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={() => {
          void navigator.clipboard.writeText(msg);
          onCopied();
        }}
      >
        <Copy className="h-4 w-4" />
        Copy message
      </Button>
    </div>
  );
}

export function DomainAttributeDialog({ item, onCopied }: { item: DomainRow; onCopied: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40"
          aria-label="Client attribute"
        >
          <User className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(dhDialogShellClass, "max-w-5xl")}>
        <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Client attribute</DialogTitle>
          <DialogDescription className="text-zinc-500">Renewal context for {item.domainName || item.domain}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-6 lg:grid-cols-3">
          <DrmSection title={item.company || "N/A"} description="Client contact">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                {(item.company || "N").charAt(0)}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.email || "—"}</p>
              <Badge variant="brand" className="normal-case">
                {item.contactNo || "No phone"}
              </Badge>
            </div>
          </DrmSection>
          <DrmSection title="Expiry dates" description="Domain & SSL">
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Globe className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Domain</p>
                  <p className="font-mono text-xs text-zinc-500">{item.domainName || item.domain}</p>
                  <Badge variant="neutral" className="mt-1 normal-case">
                    Exp: {fmtDhDate(item.expiryDate)}
                  </Badge>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">SSL</p>
                  <p className="font-mono text-xs text-zinc-500">{item.domainName || item.domain}</p>
                  <Badge variant="neutral" className="mt-1 normal-case">
                    Exp: {fmtDhDate(item.sslExpiryDate)}
                  </Badge>
                </div>
              </li>
            </ul>
          </DrmSection>
          <DrmSection title="Renewal message" description="Copy to clipboard">
            <RenewalMessageComposer item={item} onCopied={onCopied} />
          </DrmSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DomainQuotationDialog({ item }: { item: DomainRow }) {
  const hosting = item.hostingPackagePrice ? parseFloat(item.hostingPackagePrice) : 0;
  const total = (15 + hosting).toFixed(2);
  const rows = [
    { product: "Domain renewal", detail: item.domainName || item.domain || "—", total: "$15.00" },
    ...(item.hostingPackageName
      ? [
          {
            product: `Hosting (${item.hostingPackageName})`,
            detail: `Capacity: ${item.capacity || item.hostingPackageCapacity || "—"}`,
            total: `$${hosting.toFixed(2)}`,
          },
        ]
      : []),
  ];
  const columns: DataTableColumn<(typeof rows)[0]>[] = [
    { id: "product", header: "Product", cell: (r) => r.product },
    { id: "detail", header: "Detail", cell: (r) => r.detail },
    { id: "total", header: "Total", className: "text-right", cell: (r) => <span className="font-mono text-sm">{r.total}</span> },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40"
          aria-label="Quotation"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(dhDialogShellClass, "max-w-2xl")}>
        <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Quotation</DialogTitle>
          <DialogDescription>{new Date().toLocaleString()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <Field id="quotation-company" label="Company">
            <Input className={drmFieldClass} readOnly value={item.company || "N/A"} />
          </Field>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.product} />
          <div className="flex justify-between border-t border-zinc-200 pt-3 text-sm font-semibold dark:border-zinc-800">
            <span>Total renewal amount</span>
            <span className="font-mono">${total}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DomainFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  error,
  pending,
  customers,
  registries,
  servers,
  hostingPackages,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: DomainFormState;
  setForm: React.Dispatch<React.SetStateAction<DomainFormState>>;
  error: string | null;
  pending: boolean;
  customers: { id: string; companyName?: string; accountName?: string; name?: string; email?: string }[];
  registries: { id: string; name?: string }[];
  servers: { id: string; name?: string }[];
  hostingPackages: { id: string; name?: string }[];
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dhDialogShellClass, "max-w-xl")}>
        <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <DialogTitle className="text-base font-semibold">{editing ? "Edit domain" : "Add domain"}</DialogTitle>
          <DialogDescription>Domain, hosting, and SSL tracking fields.</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <DhFormGrid cols={2}>
            <Field id="df-company" label="Company" className="sm:col-span-2">
              <Select
                value={form.customerId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {customerLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="df-name" label="Domain name" className="sm:col-span-2">
              <Input
                className={drmFieldClass}
                placeholder="example.com"
                value={form.domainName}
                onChange={(e) => setForm((f) => ({ ...f, domainName: e.target.value }))}
              />
            </Field>
            <Field id="df-registry" label="Registry">
              <Select
                value={form.registryId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, registryId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {registries.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name || r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="df-server" label="Hosting server">
              <Select
                value={form.serverId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, serverId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {servers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="df-package" label="Hosting package">
              <Select
                value={form.hostingPackageId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, hostingPackageId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {hostingPackages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="df-cpanel" label="cPanel username">
              <Input
                className={drmFieldClass}
                placeholder="Optional"
                value={form.cpanelUsername}
                onChange={(e) => setForm((f) => ({ ...f, cpanelUsername: e.target.value }))}
              />
            </Field>
            <Field id="df-activation" label="Activation date">
              <Input
                type="date"
                className={drmFieldClass}
                value={form.activationDate}
                onChange={(e) => setForm((f) => ({ ...f, activationDate: e.target.value }))}
              />
            </Field>
            <Field id="df-expiry" label="Expiry date">
              <Input
                type="date"
                className={drmFieldClass}
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </Field>
          </DhFormGrid>
          {error ? <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <DrmFormActions>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={onSubmit} disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add domain"}
            </Button>
          </DrmFormActions>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DhFormSection({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <DrmSection title={title} description={description} actions={actions}>
      {children}
    </DrmSection>
  );
}
