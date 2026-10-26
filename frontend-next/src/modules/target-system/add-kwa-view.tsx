"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/legacy/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, PlusCircle, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import {
  DrmFormActions,
  DrmInlineActions,
  DrmSection,
  TargetSystemShell,
  TsFormGrid,
  drmFieldClass,
  tsDialogShellClass,
  tsSelectTriggerClass,
} from "@/modules/target-system/target-system-ui";

const readOnlyFieldClass = cn(
  drmFieldClass,
  "cursor-not-allowed bg-zinc-50 text-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-300",
);

export function AddKwaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: kwaData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-records"],
  });

  // Real customers for the Company Name autocomplete — same
  // /api/account/customers-list endpoint and search-dropdown convention used
  // by the Temp GM form.
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/account/customers-list"],
  });

  // Real users for the Person dropdown — same role-grouping convention used
  // elsewhere (KWA History, Target System, BV Report Select User pickers).
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  // Form State
  const [company, setCompany] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [kwaValue, setKwaValue] = useState("");
  const [type, setType] = useState("none");
  const [person, setPerson] = useState("none");
  const [detail, setDetail] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!company.trim()) return customers.slice(0, 20);
    const q = company.toLowerCase();
    return customers
      .filter((c) =>
        c.company_name?.toLowerCase().includes(q) ||
        c.drm_id?.toLowerCase().includes(q) ||
        c.person_name?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [company, customers]);

  // Use Kwa Modal State
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [useAmount, setUseAmount] = useState("");
  const [useAction, setUseAction] = useState<"Used" | "Refund">("Used");
  const [useDetail, setUseDetail] = useState("");
  const [usedByInput, setUsedByInput] = useState("");

  const handleOpenUseModal = (row: any) => {
    setSelectedRow(row);
    setUseAmount("");
    setUseAction("Used");
    setUseDetail("");
    // Defaults to whoever sold it — the same person usually records usage,
    // but this is editable since legacy tracks Sell By / Used By separately.
    setUsedByInput(row.employee || "");
    setIsUseModalOpen(true);
  };

  const useKwaMutation = useMutation({
    mutationFn: async (vars: { id: number; amount: number; action: string; detail?: string; usedBy?: string }) => {
      const res = await apiRequest("PATCH", `/api/target-system/kwa-records/${vars.id}/use`, {
        amount: vars.amount,
        action: vars.action,
        detail: vars.detail,
        usedBy: vars.usedBy,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update KWA record.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/kwa-records"] });
      toast({ title: "Kwa Used Successfully!" });
      setIsUseModalOpen(false);
      setSelectedRow(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update KWA record.", variant: "destructive" });
    }
  });

  const handleUseKwaSubmit = () => {
    const amount = Number(useAmount);
    if (!selectedRow || !amount || amount <= 0) {
      toast({ title: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    useKwaMutation.mutate({
      id: selectedRow.id,
      amount,
      action: useAction,
      detail: useDetail || undefined,
      usedBy: usedByInput.trim() || undefined,
    });
  };

  const saveKwaMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const res = await apiRequest("POST", "/api/target-system/kwa-records", newRecord);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create KWA record.");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/kwa-records"] });
      toast({ title: "KWA record added successfully!" });

      // Reset form
      setCompany("");
      setKwaValue("");
      setType("none");
      setPerson("none");
      setDetail("");
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create KWA record.", variant: "destructive" });
    }
  });

  const kwaColumns = useMemo((): DataTableColumn<any>[] => {
    return [
      { id: "no", header: "No#", cell: (row) => row.id, className: "tabular-nums text-zinc-500" },
      { id: "company", header: "Company", cell: (row) => <span className="font-medium">{row.company}</span> },
      { id: "employee", header: "Employee", cell: (row) => row.employee },
      { id: "kwa", header: "KWA", cell: (row) => <span className="tabular-nums">{row.kwa}$</span> },
      { id: "detail", header: "Detail", cell: (row) => row.detail || "—" },
      { id: "remaining", header: "Remaining", cell: (row) => <span className="tabular-nums">{row.remaining}$</span> },
      { id: "type", header: "Type", cell: (row) => row.type },
      {
        id: "date",
        header: "Date",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500">
            {new Date(row.createdAt)
              .toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
              .replace(/,/g, "")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right",
        cell: (row) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Use KWA"
            aria-label="Use KWA"
            className="text-emerald-700 dark:text-emerald-400"
            onClick={() => handleOpenUseModal(row)}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        ),
      },
    ];
  }, []);

  const handleSubmit = () => {
    if (!company || !kwaValue || type === "none" || person === "none") {
      toast({ title: "Please fill out all required fields (Company, Kwa, Type, Person).", variant: "destructive" });
      return;
    }

    saveKwaMutation.mutate({
      company,
      employee: person,
      kwa: kwaValue,
      detail,
      type,
    });
  };

  return (
    <TargetSystemShell title="Add KWA" description="Create and apply KWA records.">
    <div className="space-y-4">
      <DrmInlineActions
        items={[
          {
            id: "add-kwa-form",
            label: isFormOpen ? "Hide add form" : "Add KWA record",
            active: isFormOpen,
            onClick: () => setIsFormOpen((v) => !v),
          },
        ]}
      />

      {isFormOpen && (
        <DrmSection title="New KWA record" description="Search company and assign KWA to a person.">
            <TsFormGrid cols={4}>
              <div className="relative">
                <Field id="kwa-company" label="Company name">
                <div className="relative">
                  <Input
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                    placeholder="Search by ID or name…"
                    className={`${drmFieldClass} pr-9`}
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
                {showCompanyDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onMouseDown={() => {
                          setCompany(c.company_name);
                          setShowCompanyDropdown(false);
                        }}
                        className="px-2 py-1.5 text-sm cursor-pointer hover:bg-green-50 border-b border-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium text-gray-800 dark:text-zinc-100">{c.company_name}</span>
                        {c.drm_id && <span className="text-gray-400 ml-1">({c.drm_id})</span>}
                        {c.person_name && <span className="text-gray-500 ml-1 dark:text-zinc-400">• {c.person_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
                </Field>
              </div>

              <Field id="kwa-amount" label="KWA ($)">
                <Input
                  id="kwa-amount"
                  placeholder="0"
                  type="number"
                  value={kwaValue}
                  onChange={(e) => setKwaValue(e.target.value)}
                  className={drmFieldClass}
                />
              </Field>

              <Field id="kwa-type" label="Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose ...</SelectItem>
                    <SelectItem value="Kwa">Kwa</SelectItem>
                    <SelectItem value="Cat">Cat</SelectItem>
                    <SelectItem value="Ai">Ai</SelectItem>
                    <SelectItem value="Psa">Psa</SelectItem>
                    <SelectItem value="SA">SA</SelectItem>
                    <SelectItem value="Resubmission of BV">Resubmission of BV</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field id="kwa-person" label="Person">
                <Select value={person} onValueChange={setPerson}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose...</SelectItem>
                    {groupedUsers.map(({ role, users }) => (
                      <SelectGroup key={role}>
                        <SelectLabel>{role}</SelectLabel>
                        {users.filter((u) => u.fullName || u.username).map((u) => (
                          <SelectItem key={u.id} value={u.fullName || u.username}>
                            {u.fullName || u.username}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </TsFormGrid>

            <Field id="kwa-detail" label="Detail" className="mt-4">
              <Input
                id="kwa-detail"
                placeholder="Optional detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className={drmFieldClass}
              />
            </Field>

            <DrmFormActions>
              <Button type="button" variant="primary" size="sm" onClick={handleSubmit}>
                <Plus className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </DrmFormActions>
        </DrmSection>
      )}

      <DrmSection
        title="KWA records"
        description={isLoading ? "Loading…" : `${kwaData.length} record(s)`}
      >
        <DataTable
          columns={kwaColumns}
          rows={kwaData}
          rowKey={(row) => String(row.id)}
          loading={isLoading}
          emptyMessage="No KWA records found."
          className="min-w-[900px]"
        />
      </DrmSection>
    </div>

      <Dialog
        open={isUseModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
            setUseAmount("");
            setUseDetail("");
            setUsedByInput("");
            setUseAction("Used");
          }
          setIsUseModalOpen(open);
        }}
      >
        <DialogContent className={`${tsDialogShellClass} gap-0 sm:max-w-xl`}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle>Use KWA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <TsFormGrid cols={4}>
              <Field id="use-company" label="Company">
                <Input id="use-company" value={selectedRow?.company || ""} disabled readOnly className={readOnlyFieldClass} />
              </Field>
              <Field id="use-person" label="Person">
                <Input id="use-person" value={selectedRow?.employee || ""} disabled readOnly className={readOnlyFieldClass} />
              </Field>
              <Field id="use-remaining" label="Remaining">
                <Input
                  id="use-remaining"
                  value={selectedRow != null ? `${selectedRow.remaining}$` : ""}
                  disabled
                  readOnly
                  className={readOnlyFieldClass}
                />
              </Field>
              <Field id="use-used-by" label="Used by">
                <Input
                  id="use-used-by"
                  placeholder="Who is using this?"
                  value={usedByInput}
                  onChange={(e) => setUsedByInput(e.target.value)}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="use-amount" label="KWA ($)">
                <Input
                  id="use-amount"
                  placeholder="0"
                  type="number"
                  min={0}
                  step="any"
                  value={useAmount}
                  onChange={(e) => setUseAmount(e.target.value)}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="use-type" label="KWA type">
                <Select value={useAction} onValueChange={(v) => setUseAction(v as "Used" | "Refund")}>
                  <SelectTrigger className={tsSelectTriggerClass}>
                    <SelectValue placeholder="Used" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Used">Used</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </TsFormGrid>
            <Field id="use-detail" label="Detail">
              <Textarea
                id="use-detail"
                value={useDetail}
                onChange={(e) => setUseDetail(e.target.value)}
                placeholder="Optional notes"
                className={cn(drmFieldClass, "min-h-[100px] resize-y")}
              />
            </Field>
          </div>
          <DialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsUseModalOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleUseKwaSubmit} disabled={useKwaMutation.isPending}>
              {useKwaMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TargetSystemShell>
  );
}
