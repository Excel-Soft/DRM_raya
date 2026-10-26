"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, Check, FileSpreadsheet, FileText, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/legacy/dropdown-menu";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { normalizeRole } from "@/lib/auth/role-utils";
import { exportToCSV, exportToExcel } from "@/lib/export/export-utils";
import { cn } from "@/lib/utils/cn";
import { OfficeAccountShell, DrmSection, DrmFormModal } from "@/modules/office-account/office-account-ui";
import type { AccountHead } from "@/modules/office-account/office-account-types";

const OFFICES = ["Karachi", "Lahore-Raya", "Lahore-GulBerg", "Sialkot-Welc", "Sialkot-Webexcels", "Gujranwala branch"];

interface OfficeExpenseRow {
  id: string;
  expenseHead: string;
  office: string;
  amount: string;
  currency: string | null;
  voucherNumber: string | null;
  chequeNumber: string | null;
  fileUrl: string | null;
  detail: string | null;
  expenseDate: string;
  createdByName?: string;
}

interface ChequeOption {
  id: string;
  chequeNumber: string | null;
  companyName: string | null;
  chequeDate: string | null;
  amount: string | null;
  remainingAmount: string | null;
  status: string | null;
}

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-600 shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <span className="truncate">{selected.length > 0 ? (selected.includes("all") ? "All" : selected.join(", ")) : placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] border border-zinc-200 bg-white p-0 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        <DropdownMenuCheckboxItem
          checked={selected.length === 0 || selected.includes("all")}
          onCheckedChange={(checked) => onChange(checked ? ["all"] : [])}
          onSelect={(e) => e.preventDefault()}
          className="cursor-pointer rounded-none bg-emerald-700 py-2 text-[13px] font-medium text-white focus:bg-emerald-700 focus:text-white"
        >
          All
        </DropdownMenuCheckboxItem>
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selected.includes(opt) && !selected.includes("all")}
            onCheckedChange={(checked) => {
              let next = selected.filter((x) => x !== "all");
              next = checked ? [...next, opt] : next.filter((x) => x !== opt);
              onChange(next);
            }}
            onSelect={(e) => e.preventDefault()}
            className="cursor-pointer py-2 text-[13px] text-zinc-700 dark:text-zinc-300"
          >
            {opt}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            <span className="inline-flex items-center gap-2">
              <Check className={cn("h-3.5 w-3.5", value === opt ? "opacity-100" : "opacity-0")} />
              {opt}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const EMPTY_FORM = {
  expenseHead: "",
  office: "",
  amount: "",
  currency: "PKR",
  voucherNumber: "",
  chequeNumber: "",
  detail: "",
  files: [] as { name: string; url: string }[],
  expenseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
};
type FormState = typeof EMPTY_FORM;

export function OfficeExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempFilterOffice, setTempFilterOffice] = useState<string[]>(["all"]);
  const [tempAccountingHead, setTempAccountingHead] = useState<string[]>(["all"]);
  const [tempParentHead, setTempParentHead] = useState<string[]>(["all"]);
  const [tempChildHead, setTempChildHead] = useState<string[]>(["all"]);
  const [tempTransactionalHead, setTempTransactionalHead] = useState<string[]>(["all"]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterOffice, setFilterOffice] = useState<string[]>(["all"]);
  const [filterAccountingHead, setFilterAccountingHead] = useState<string[]>(["all"]);
  const [filterParentHead, setFilterParentHead] = useState<string[]>(["all"]);
  const [filterChildHead, setFilterChildHead] = useState<string[]>(["all"]);
  const [filterTransactionalHead, setFilterTransactionalHead] = useState<string[]>(["all"]);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => (await apiRequest("GET", "/api/auth/me")).json(),
  });
  const isAdmin = ["admin", "super_admin", "adm"].includes(normalizeRole(currentUser?.activeRoleId ?? currentUser?.role));

  const allFilteredHeads = useMemo(
    () => [...filterAccountingHead, ...filterParentHead, ...filterChildHead, ...filterTransactionalHead].filter((h) => h !== "all"),
    [filterAccountingHead, filterParentHead, filterChildHead, filterTransactionalHead],
  );

  const { data: expenses = [], isLoading, isError, refetch } = useQuery<OfficeExpenseRow[]>({
    queryKey: ["/api/office/expenses", startDate, endDate, filterOffice.join(","), allFilteredHeads.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (filterOffice.length > 0 && !filterOffice.includes("all")) params.set("office", filterOffice.join(","));
      if (allFilteredHeads.length > 0) params.set("accountingHead", allFilteredHeads.join(","));
      const res = await apiRequest("GET", `/api/office/expenses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
  });

  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: async () => (await apiRequest("GET", "/api/office/account-heads")).json(),
  });

  const transactionalHeads = useMemo(
    () => accountHeads.filter((h) => h.type === "Transactional" || h.type === "Sub-Transactional").map((h) => h.name).sort(),
    [accountHeads],
  );
  const accountingHeadOptions = useMemo(
    () => Array.from(new Set(accountHeads.map((h) => h.category || "General").filter(Boolean))).sort(),
    [accountHeads],
  );
  const parentHeadOptions = useMemo(() => accountHeads.filter((h) => h.type === "Parent").map((h) => h.name).sort(), [accountHeads]);
  const childHeadOptions = useMemo(() => accountHeads.filter((h) => h.type === "Child").map((h) => h.name).sort(), [accountHeads]);

  const { data: cheques = [] } = useQuery<ChequeOption[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: async () => (await apiRequest("GET", "/api/office/cheques")).json(),
  });
  const unusedCheques = cheques.filter((c) => c.status === "Pending" && parseFloat(c.remainingAmount ?? c.amount ?? "0") > 0);

  function resetForm() {
    setFormData({ ...EMPTY_FORM, expenseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(expense: OfficeExpenseRow) {
    let parsedFiles: { name: string; url: string }[] = [];
    if (expense.fileUrl) {
      try {
        const parsed = JSON.parse(expense.fileUrl);
        parsedFiles = Array.isArray(parsed) ? parsed : [{ name: "Attached File", url: expense.fileUrl }];
      } catch {
        parsedFiles = [{ name: "Attached File", url: expense.fileUrl }];
      }
    }
    setEditingId(expense.id);
    setFormData({
      expenseHead: expense.expenseHead || "",
      office: expense.office || "",
      amount: expense.amount || "",
      currency: expense.currency || "PKR",
      voucherNumber: expense.voucherNumber || "",
      chequeNumber: expense.chequeNumber || "",
      detail: expense.detail || "",
      files: parsedFiles,
      expenseDate: expense.expenseDate ? format(new Date(expense.expenseDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.expenseHead || !formData.office || !formData.amount) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    if (!(parseFloat(formData.amount) > 0)) {
      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    const payload = {
      expenseHead: formData.expenseHead,
      office: formData.office,
      amount: formData.amount,
      currency: formData.currency || "PKR",
      voucherNumber: formData.voucherNumber || undefined,
      chequeNumber: formData.chequeNumber || undefined,
      detail: formData.detail || undefined,
      fileUrl: formData.files.length > 0 ? JSON.stringify(formData.files) : undefined,
      expenseDate: formData.expenseDate ? new Date(formData.expenseDate).toISOString() : new Date().toISOString(),
    };
    setSaving(true);
    try {
      if (editingId) {
        await mutationRequest("PATCH", `/api/office/expenses/${editingId}`, payload);
        toast({ title: "Saved", description: "Expense updated successfully" });
      } else {
        await mutationRequest("POST", "/api/office/expenses", payload);
        toast({ title: "Success", description: "Expense added successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/office/expenses"] });
      setDialogOpen(false);
      setEditingId(null);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save expense", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const reason = window.prompt("Enter a reason for deleting this expense (required):")?.trim();
    if (!reason) return;
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await apiRequest("DELETE", `/api/office/expenses/${id}`, { reason });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || "Failed to delete expense");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/office/expenses"] });
      toast({ title: "Deleted", description: "Expense deleted" });
    } catch (e: any) {
      toast({ title: "Not deleted", description: e?.message || "Failed to delete expense", variant: "destructive" });
    }
  }

  function handleView() {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setFilterOffice(tempFilterOffice);
    setFilterAccountingHead(tempAccountingHead);
    setFilterParentHead(tempParentHead);
    setFilterChildHead(tempChildHead);
    setFilterTransactionalHead(tempTransactionalHead);
  }

  function handleClearFilters() {
    setTempStartDate("");
    setTempEndDate("");
    setTempFilterOffice(["all"]);
    setTempAccountingHead(["all"]);
    setTempParentHead(["all"]);
    setTempChildHead(["all"]);
    setTempTransactionalHead(["all"]);
    setStartDate("");
    setEndDate("");
    setFilterOffice(["all"]);
    setFilterAccountingHead(["all"]);
    setFilterParentHead(["all"]);
    setFilterChildHead(["all"]);
    setFilterTransactionalHead(["all"]);
  }

  const dialogHeadOptions = useMemo(() => {
    const set = new Set<string>(transactionalHeads);
    for (const e of expenses) if (e.expenseHead) set.add(e.expenseHead);
    if (formData.expenseHead) set.add(formData.expenseHead);
    return Array.from(set).sort();
  }, [expenses, formData.expenseHead, transactionalHeads]);

  const dialogOfficeOptions = useMemo(() => {
    const set = new Set<string>(OFFICES);
    for (const e of expenses) if (e.office) set.add(e.office);
    if (formData.office) set.add(formData.office);
    return Array.from(set);
  }, [expenses, formData.office]);

  const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  function formatCurrency(amount: string | null): string {
    if (!amount) return "0.00";
    return (parseFloat(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  function handleExportCSV() {
    if (expenses.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    exportToCSV(
      expenses,
      [
        { key: "no", header: "No", format: (_v, row) => expenses.indexOf(row) + 1 },
        { key: "expenseDate", header: "Date", format: (v) => format(new Date(v), "yyyy-MM-dd") },
        { key: "office", header: "Branch" },
        { key: "expenseHead", header: "Head" },
        { key: "detail", header: "Detail" },
        { key: "voucherNumber", header: "Voucher Number" },
        { key: "amount", header: "Amount" },
        { key: "currency", header: "Currency" },
        { key: "createdByName", header: "Created By", format: (v) => v || "System" },
      ],
      "office_expenses",
    );
  }

  function handleExportExcel() {
    if (expenses.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    exportToExcel(
      expenses,
      [
        { key: "no", header: "No", format: (_v, row) => expenses.indexOf(row) + 1 },
        { key: "expenseDate", header: "Date", format: (v) => format(new Date(v), "yyyy-MM-dd") },
        { key: "office", header: "Branch" },
        { key: "expenseHead", header: "Head" },
        { key: "detail", header: "Detail" },
        { key: "voucherNumber", header: "Voucher Number" },
        { key: "amount", header: "Amount" },
        { key: "currency", header: "Currency" },
        { key: "createdByName", header: "Created By", format: (v) => v || "System" },
      ],
      "office_expenses",
    );
  }

  const columns: DataTableColumn<OfficeExpenseRow>[] = [
    { id: "no", header: "#", cell: (r) => expenses.indexOf(r) + 1 },
    { id: "date", header: "Date", cell: (r) => format(new Date(r.expenseDate), "yyyy-MM-dd") },
    { id: "branch", header: "Branch", cell: (r) => r.office },
    { id: "head", header: "Head", cell: (r) => r.expenseHead },
    { id: "detail", header: "Detail", cell: (r) => <span className="line-clamp-1 max-w-[200px]">{r.detail || "-"}</span> },
    { id: "voucher", header: "Voucher Number", cell: (r) => r.voucherNumber || "-" },
    { id: "amount", header: "Amount", cell: (r) => formatCurrency(r.amount) },
    { id: "createdBy", header: "Created By", cell: (r) => r.createdByName || "System" },
    {
      id: "receipt",
      header: "Receipt",
      cell: (r) => {
        if (!r.fileUrl) return "-";
        try {
          const parsed = JSON.parse(r.fileUrl);
          if (Array.isArray(parsed)) {
            return (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {parsed.map((file: { name: string; url: string }, idx: number) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-emerald-500 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white"
                  >
                    <FileText className="h-3 w-3" /> {idx + 1}
                  </a>
                ))}
              </div>
            );
          }
        } catch {
          /* fall through to single-link rendering below */
        }
        return (
          <a
            href={r.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-emerald-500 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white"
          >
            <FileText className="h-3 w-3" /> 1
          </a>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5 text-blue-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 disabled:opacity-40" disabled={!isAdmin} onClick={() => handleDelete(r.id)}>
            <Trash2 className={cn("h-3.5 w-3.5", isAdmin ? "text-red-500" : "text-zinc-400")} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <OfficeAccountShell title="Office Expense">
      <DrmSection title="Filters" actions={<Button onClick={openCreate}>Add Expense</Button>}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-4">
          <Field id="exp-accounting-head" label="Select Accounting Head *">
            <MultiSelectDropdown options={accountingHeadOptions} selected={tempAccountingHead} onChange={setTempAccountingHead} placeholder="Select one or more options" />
          </Field>
          <Field id="exp-parent-head" label="Select Parent Head *">
            <MultiSelectDropdown options={parentHeadOptions} selected={tempParentHead} onChange={setTempParentHead} placeholder="Select one or more options" />
          </Field>
          <Field id="exp-child-head" label="Select Child Head *">
            <MultiSelectDropdown options={childHeadOptions} selected={tempChildHead} onChange={setTempChildHead} placeholder="Select one or more options" />
          </Field>
          <Field id="exp-transactional-head" label="Select Transactional Head *">
            <MultiSelectDropdown options={transactionalHeads} selected={tempTransactionalHead} onChange={setTempTransactionalHead} placeholder="Select one or more options" />
          </Field>
          <Field id="exp-office" label="Select Office *">
            <MultiSelectDropdown options={OFFICES} selected={tempFilterOffice} onChange={setTempFilterOffice} placeholder="Select one or more options" />
          </Field>
          <Field id="exp-start" label="Start Date *">
            <Input id="exp-start" type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
          </Field>
          <Field id="exp-end" label="End Date *">
            <Input id="exp-end" type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleView}>View</Button>
          <Button variant="secondary" onClick={handleClearFilters}>Clear Filter</Button>
        </div>
      </DrmSection>

      <DrmSection title="Expense List">
        <div className="mb-4 flex gap-2">
          <Button size="sm" onClick={handleExportCSV} className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export to CSV
          </Button>
          <Button size="sm" onClick={handleExportExcel} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Export to Excel
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={expenses}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError ? "Failed to load expenses. Please try again." : null}
          onRetry={() => refetch()}
          emptyMessage="No expenses generated yet."
          className="min-w-[1200px]"
        />
        <div className="mt-2 flex justify-end border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800">
          <span className="mr-3 font-bold text-zinc-700 dark:text-zinc-300">Total:</span>
          <span className="text-zinc-700 dark:text-zinc-300">{formatCurrency(totalAmount.toString())}</span>
        </div>
      </DrmSection>

      <DrmFormModal
        open={dialogOpen}
        title={editingId ? "Edit Expense" : "Add Expense"}
        onClose={() => { setDialogOpen(false); setEditingId(null); resetForm(); }}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Close</Button>
            <Button onClick={handleSubmit} disabled={saving} aria-busy={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field id="exp-head" label="Select Transactional Head:">
              <SearchableSelect options={dialogHeadOptions} value={formData.expenseHead} onChange={(v) => setFormData((f) => ({ ...f, expenseHead: v }))} placeholder="Choose..." />
            </Field>
            <Field id="exp-amount" label="Amount:">
              <Input id="exp-amount" type="number" value={formData.amount} onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field id="exp-office-select" label="Select Office:">
              <Select value={formData.office} onValueChange={(v) => setFormData((f) => ({ ...f, office: v }))}>
                <SelectTrigger id="exp-office-select"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {dialogOfficeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="exp-voucher" label="Voucher Number:" hint="Numbers only (e.g., 0987, 1234)">
              <Input id="exp-voucher" value={formData.voucherNumber} onChange={(e) => setFormData((f) => ({ ...f, voucherNumber: e.target.value }))} placeholder="Enter voucher number" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field id="exp-date" label="Creation Date:">
              <Input id="exp-date" type="datetime-local" value={formData.expenseDate} onChange={(e) => setFormData((f) => ({ ...f, expenseDate: e.target.value }))} />
            </Field>
            <Field id="exp-cheque" label="Select Cheque:">
              <Select value={formData.chequeNumber} onValueChange={(v) => setFormData((f) => ({ ...f, chequeNumber: v }))}>
                <SelectTrigger id="exp-cheque"><SelectValue placeholder="Choose cheque..." /></SelectTrigger>
                <SelectContent>
                  {unusedCheques.length > 0 ? (
                    unusedCheques.map((c) => (
                      <SelectItem key={c.id} value={c.chequeNumber || c.id}>
                        <div className="flex w-[250px] items-center justify-between">
                          <div className="flex flex-col text-left">
                            <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{c.companyName || "Unknown"}</span>
                            <span className="mt-1 text-[11px] text-zinc-500">Date: {c.chequeDate ? format(new Date(c.chequeDate), "dd-MMM-yyyy") : "-"}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[13px] font-medium text-emerald-600">Remaining: {c.remainingAmount ?? c.amount ?? "0.00"}</span>
                            <span className="mt-1 text-[11px] text-zinc-500">Total: {c.amount ?? "0.00"}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-3 text-center text-sm text-zinc-500">No unused cheques available</div>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="exp-files" label="Bill/Invoice:">
            <div className="space-y-2">
              {formData.files.map((file, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="flex h-10 shrink-0 items-center rounded-l border border-r-0 border-zinc-300 bg-zinc-100 px-4 text-[13px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800">
                    File {idx + 1}
                  </div>
                  <div className="flex h-10 flex-1 items-center truncate border border-zinc-300 bg-white px-3 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="w-full truncate text-blue-500 hover:underline">{file.name}</a>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    className="h-10 w-12 shrink-0 rounded-l-none"
                    onClick={() => setFormData((f) => ({ ...f, files: f.files.filter((_, i) => i !== idx) }))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="relative flex">
                <input
                  type="file"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  value=""
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFormData((f) => ({ ...f, files: [...f.files, { name: file.name, url: reader.result as string }] }));
                    };
                    reader.readAsDataURL(file);
                  }}
                  accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.xls,.xlsx"
                />
                <div className="pointer-events-none flex h-10 shrink-0 items-center rounded-l border border-r-0 border-zinc-300 bg-zinc-100 px-4 text-[13px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800">
                  Choose File
                </div>
                <div className="pointer-events-none flex h-10 flex-1 items-center truncate border border-zinc-300 bg-white px-3 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                  Click to add a file
                </div>
                <div className="pointer-events-none flex h-10 w-12 shrink-0 items-center justify-center rounded-r border border-emerald-500 bg-emerald-500">
                  <Plus className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-[12px] leading-[1.3] text-rose-500">
                Allowed file types: .jpg, .jpeg, .png, .gif, .bmp, .webp, .pdf, .xls, .xlsx
                <br />
                You can upload files up to 10MBs.
              </p>
            </div>
          </Field>

          <Field id="exp-detail" label="Detail: *">
            <Textarea id="exp-detail" value={formData.detail} onChange={(e) => setFormData((f) => ({ ...f, detail: e.target.value }))} className="min-h-[80px]" />
          </Field>
        </div>
      </DrmFormModal>
    </OfficeAccountShell>
  );
}
