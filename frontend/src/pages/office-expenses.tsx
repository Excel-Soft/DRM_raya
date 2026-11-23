import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, mutationRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Pencil, FileSpreadsheet, FileText, ChevronDown, Check, Plus, Minus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { utils, writeFile } from "xlsx";
import type { OfficeExpense, AccountHead } from "@shared/schema";

const OFFICES = [
  "Karachi",
  "Lahore-Raya",
  "Lahore-GulBerg",
  "Sialkot-Welc",
  "Sialkot-Webexcels",
  "Gujranwala branch"
];
// Filter also offers the office names used by old-DRM expenses ("Main" = head office).
const FILTER_OFFICES = [...OFFICES, "Main", "Sialkot", "Lahore", "Wazirabad Branch"];
const EXPENSE_HEADS = ["Rent", "Utilities", "Salaries", "Office Supplies", "Travel", "Marketing", "Maintenance", "Miscellaneous"];



// Old-DRM receipts live on the legacy server; served (and cached) via the https-safe proxy.
const legacyReceiptUrl = (file: string) => `/api/legacy-assets/expense-bill?f=${encodeURIComponent(file)}`;

function LegacyReceiptLinks({ files }: { files: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {files.map((file, idx) => {
        const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(file);
        return (
          <a
            key={file}
            href={legacyReceiptUrl(file)}
            target="_blank"
            rel="noreferrer"
            title={file}
            className="inline-flex items-center gap-1 bg-white border border-[#2bc185] text-[#2bc185] hover:bg-[#2bc185] hover:text-white px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
          >
            {isImage ? (
              <img src={legacyReceiptUrl(file)} alt="" loading="lazy" decoding="async" className="h-5 w-5 rounded-sm object-cover" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            {idx + 1}
          </a>
        );
      })}
    </div>
  );
}

const MultiSelectDropdown = ({ options, selected, onChange, placeholder }: { options: string[], selected: string[], onChange: (val: string[]) => void, placeholder: string }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-[4px] border border-gray-300 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-gray-500 shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
        <span className="truncate">{selected.length > 0 ? (selected.includes("all") ? "All" : selected.join(", ")) : placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] p-0 bg-white dark:bg-zinc-900 shadow-md border border-gray-200">
        <div className="px-3 py-2 border-b border-gray-100 text-[13px] text-gray-500 font-sans cursor-text bg-white dark:bg-zinc-900">
          |{placeholder}
        </div>
        <DropdownMenuCheckboxItem 
          checked={selected.length === 0 || selected.includes("all")} 
          onCheckedChange={(checked) => {
            if (checked) onChange(["all"]);
            else onChange([]);
          }}
          onSelect={(e) => e.preventDefault()}
          className="bg-[#0f8b4d] text-white focus:bg-[#0f8b4d] focus:text-white rounded-none py-2 text-[13px] font-medium cursor-pointer"
        >
          All
        </DropdownMenuCheckboxItem>
        {options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selected.includes(opt) && !selected.includes("all")}
            onCheckedChange={(checked) => {
              let newSelected = selected.filter(x => x !== "all");
              if (checked) newSelected = [...newSelected, opt];
              else newSelected = newSelected.filter(x => x !== opt);
              onChange(newSelected.length === 0 ? [] : newSelected);
            }}
            onSelect={(e) => e.preventDefault()}
            className="py-2 text-[13px] text-gray-700 cursor-pointer"
          >
            {opt}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }: { options: string[], value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o === value) || value;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10 border-gray-300 text-gray-600 rounded-[4px] font-normal px-3 bg-transparent hover:bg-transparent hover:text-gray-600">
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search heads..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={(currentValue) => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Uploaded expense files are stored as data: URIs (no server-side upload for
// this page), but Chrome (and other Chromium browsers) blocks top-level
// navigation straight to a data: URL — clicking <a href="data:..."
// target="_blank"> just opens a blank white tab with nothing rendered. Convert
// to a blob: URL first, which isn't subject to that restriction and opens
// correctly for images, PDFs, and anything else the browser can display.
function openUploadedFile(url: string, fileName?: string) {
  if (!url) return;
  if (!url.startsWith("data:")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const [header, base64] = url.split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err) {
    console.error(`Failed to open ${fileName || "file"}:`, err);
  }
}

export default function OfficeExpenses() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedTableSearch, setDebouncedTableSearch] = useState("");
  // Server-side pagination: 50 most recent expenses per page.
  const rowsPerPage = 50;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTableSearch(tableSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [tableSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedTableSearch]);

  // Temporary filter states (bound to inputs)
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempFilterOffice, setTempFilterOffice] = useState<string[]>(["all"]);
  const [tempAccountingHead, setTempAccountingHead] = useState<string[]>(["all"]);
  const [tempParentHead, setTempParentHead] = useState<string[]>(["all"]);
  const [tempChildHead, setTempChildHead] = useState<string[]>(["all"]);
  const [tempTransactionalHead, setTempTransactionalHead] = useState<string[]>(["all"]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Applied filter states (used for fetching)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterOffice, setFilterOffice] = useState<string[]>(["all"]);
  const [filterAccountingHead, setFilterAccountingHead] = useState<string[]>(["all"]);
  const [filterParentHead, setFilterParentHead] = useState<string[]>(["all"]);
  const [filterChildHead, setFilterChildHead] = useState<string[]>(["all"]);
  const [filterTransactionalHead, setFilterTransactionalHead] = useState<string[]>(["all"]);

  // Fetch current role to determine delete permissions
  const currentRole = sessionStorage.getItem("userRole") || "";
  const isAdmin = ["admin", "super_admin", "adm"].includes(currentRole.toLowerCase());
  // Delete is shown to admin, super HOD and HOD only (backend enforces the same).
  const canDeleteExpense = ["admin", "super_admin", "adm", "super_hod", "hod"].includes(
    currentRole.toLowerCase().replace(/\s+/g, "_"),
  );

  const [formData, setFormData] = useState({
    expenseHead: "",
    office: "",
    amount: "",
    currency: "PKR",
    voucherNumber: "",
    chequeNumber: "",
    detail: "",
    fileName: "",
    fileUrl: "",
    files: [] as {name: string, url: string}[],
    expenseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  // Chart of Accounts tree (DRM -> Office Account -> Chart of Account). Levels come from
  // parent_account_id: 1 Accounting head (Assets...), 2 Parent, 3 Child, 4 Transactional.
  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: () => apiRequestJson<AccountHead[]>("GET", "/api/office/account-heads"),
  });
  const headTree = useMemo(() => {
    const byId = new Map<string, AccountHead>();
    for (const h of accountHeads) byId.set(h.id, h);
    const levelOf = (h: AccountHead): number => {
      let lvl = 1;
      let cur: AccountHead | undefined = h;
      const seen = new Set<string>();
      while (cur?.parentAccountId && byId.has(cur.parentAccountId) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parentAccountId);
        lvl++;
      }
      return lvl;
    };
    const label = (h: AccountHead) => (h.code ? `${h.code} - ${h.name}` : h.name);
    const nodes = accountHeads.map((h) => ({ head: h, level: levelOf(h), label: label(h) }));
    const idByLabel = new Map(nodes.map((n) => [n.label, n.head.id]));
    const labelById = new Map(nodes.map((n) => [n.head.id, n.label]));
    const hasChildren = new Set(accountHeads.map((h) => h.parentAccountId).filter(Boolean) as string[]);
    return { nodes, idByLabel, labelById, hasChildren, byId };
  }, [accountHeads]);
  const isUnder = (headId: string, ancestorIds: Set<string>) => {
    let cur = headTree.byId.get(headId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (ancestorIds.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.parentAccountId ? headTree.byId.get(cur.parentAccountId) : undefined;
    }
    return false;
  };
  const headIdsParam = useMemo(
    () => allFilteredHeadsLabels().map((l) => headTree.idByLabel.get(l)).filter(Boolean).join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterAccountingHead, filterParentHead, filterChildHead, filterTransactionalHead, headTree],
  );
  function allFilteredHeadsLabels(): string[] {
    const sel = (a: string[]) => a.filter((h) => h !== "all");
    if (sel(filterTransactionalHead).length) return sel(filterTransactionalHead);
    if (sel(filterChildHead).length) return sel(filterChildHead);
    if (sel(filterParentHead).length) return sel(filterParentHead);
    return sel(filterAccountingHead);
  }

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (filterOffice.length > 0 && !filterOffice.includes("all")) queryParams.set("office", filterOffice.join(","));
  if (headIdsParam) queryParams.set("headIds", headIdsParam);
  if (debouncedTableSearch) queryParams.set("search", debouncedTableSearch);
  
  // Head filters hold "code - name" labels; the API gets the ids of the most specific
  // level that has a selection and expands to every head below it.
  const pickSel = (sel: string[]) => sel.filter((h) => h !== "all");
  const headSelection =
    pickSel(filterTransactionalHead).length ? pickSel(filterTransactionalHead)
    : pickSel(filterChildHead).length ? pickSel(filterChildHead)
    : pickSel(filterParentHead).length ? pickSel(filterParentHead)
    : pickSel(filterAccountingHead);
  const allFilteredHeads = headSelection;

  type ExpenseRow = OfficeExpense & { createdByName?: string; legacyReceipts?: string[]; expenseHeadId?: string };
  const { data: expensePage, isLoading, isError, isFetching: expensesFetching } = useQuery<{
    data: ExpenseRow[]; total: number; totalAmount: string; page: number; pageSize: number;
  }>({
    queryKey: ["/api/office/expenses", startDate, endDate, filterOffice.join(","), allFilteredHeads.join(","), headIdsParam, debouncedTableSearch, currentPage],
    queryFn: () =>
      apiRequestJson("GET", `/api/office/expenses?${queryParams.toString()}&page=${currentPage}&pageSize=${rowsPerPage}`),
    placeholderData: (prev) => prev,
  });
  const expenses: ExpenseRow[] = expensePage?.data ?? [];
  const expenseTotal = expensePage?.total ?? 0;
  // Export: all rows matching the current filters (fetched only when exporting).
  const fetchAllForExport = () =>
    apiRequestJson<ExpenseRow[]>("GET", `/api/office/expenses?${queryParams.toString()}`);

  const { data: cheques = [] } = useQuery<any[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: () => apiRequestJson<any[]>("GET", "/api/office/cheques"),
  });

  const unusedCheques = (Array.isArray(cheques) ? cheques : []).filter((c: any) => 
    c.status === "Pending" && parseFloat(c.remainingAmount ?? c.amount ?? "0") > 0
  );

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      mutationRequest("POST", "/api/office/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/expenses"] });
      setDialogOpen(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Success", description: "Expense added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to add expense", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      mutationRequest("PATCH", `/api/office/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/expenses"] });
      setDialogOpen(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Saved", description: "Expense updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update expense", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const reason = window.prompt("Enter a reason for deleting this expense (required):")?.trim();
      if (!reason) {
        throw new Error("Deletion cancelled: a reason is required.");
      }
      const res = await apiRequest("DELETE", `/api/office/expenses/${id}`, { reason });
      if (!res.ok) {
        let msg = "Failed to delete expense";
        try {
          const body = await res.json();
          msg = body?.error?.message || body?.message || body?.error || msg;
        } catch {}
        throw new Error(msg);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/expenses"] });
      toast({ title: "Deleted", description: "Expense deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Not deleted", description: error?.message || "Failed to delete expense", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      expenseHead: "",
      office: "",
      amount: "",
      currency: "PKR",
      voucherNumber: "",
      chequeNumber: "",
      detail: "",
      fileName: "",
      fileUrl: "",
      files: [],
      expenseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const handleSubmit = () => {
    if (!formData.expenseHead || !formData.office || !formData.amount) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    if (!(parseFloat(formData.amount) > 0)) {
      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }

    const finalFileUrl = formData.files && formData.files.length > 0 ? JSON.stringify(formData.files) : undefined;

    const payload = {
      expenseHead: formData.expenseHead,
      office: formData.office,
      amount: formData.amount,
      currency: formData.currency || "PKR",
      voucherNumber: formData.voucherNumber || undefined,
      chequeNumber: formData.chequeNumber || undefined,
      detail: formData.detail || undefined,
      fileUrl: finalFileUrl,
      expenseDate: formData.expenseDate ? new Date(formData.expenseDate).toISOString() : new Date().toISOString(),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (expense: OfficeExpense) => {
    let parsedFiles: {name: string, url: string}[] = [];
    if (expense.fileUrl) {
      try {
        const parsed = JSON.parse(expense.fileUrl);
        if (Array.isArray(parsed)) {
          parsedFiles = parsed;
        } else {
          parsedFiles = [{ name: "Attached File", url: expense.fileUrl }];
        }
      } catch {
        parsedFiles = [{ name: "Attached File", url: expense.fileUrl }];
      }
    }

    setEditingId(expense.id);
    setFormData({
      expenseHead: (expense as any).expenseHeadId || expense.expenseHead || "",
      office: expense.office || "",
      amount: expense.amount || "",
      currency: expense.currency || "PKR",
      voucherNumber: expense.voucherNumber || "",
      chequeNumber: expense.chequeNumber || "",
      detail: expense.detail || "",
      fileName: "",
      fileUrl: "",
      files: parsedFiles,
      expenseDate: expense.expenseDate ? format(new Date(expense.expenseDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setDialogOpen(true);
  };

  const handleView = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setFilterOffice(tempFilterOffice);
    setFilterAccountingHead(tempAccountingHead);
    setFilterParentHead(tempParentHead);
    setFilterChildHead(tempChildHead);
    setFilterTransactionalHead(tempTransactionalHead);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
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
    setTableSearch("");
    setDebouncedTableSearch("");
    setCurrentPage(1);
  };

  const expensesList = Array.isArray(expenses) ? expenses : [];
  const paginatedExpenses = expensesList;
  const totalPages = Math.max(1, Math.ceil(expenseTotal / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageButtons: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1) pageButtons.push(n);
    else if (pageButtons[pageButtons.length - 1] !== "gap") pageButtons.push("gap");
  }

  // Head filter options derived from accountHeads API
  // Cascading head filters (uses the temp selections so options follow what is picked).
  const idsOf = (labels: string[]) =>
    new Set(labels.filter((l) => l !== "all").map((l) => headTree.idByLabel.get(l)).filter(Boolean) as string[]);
  const optionsAt = (level: number, scopes: Set<string>[]) => {
    const scope = scopes.find((sc) => sc.size > 0);
    return headTree.nodes
      .filter((n) => n.level === level && (!scope || isUnder(n.head.id, scope)))
      .sort((a, b) => String(a.head.code).localeCompare(String(b.head.code), undefined, { numeric: true }))
      .map((n) => n.label);
  };
  const accountingHeadOptions = useMemo(() => optionsAt(1, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headTree]);
  const parentHeadOptions = useMemo(() => optionsAt(2, [idsOf(tempAccountingHead)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headTree, tempAccountingHead]);
  const childHeadOptions = useMemo(() => optionsAt(3, [idsOf(tempParentHead), idsOf(tempAccountingHead)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headTree, tempParentHead, tempAccountingHead]);
  const transactionalHeads = useMemo(() => optionsAt(4, [idsOf(tempChildHead), idsOf(tempParentHead), idsOf(tempAccountingHead)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headTree, tempChildHead, tempParentHead, tempAccountingHead]);
  // Heads an expense can be booked on: the lowest level of each branch (leaf heads).
  const bookableHeadLabels = useMemo(
    () => headTree.nodes
      .filter((n) => n.level >= 3 && !headTree.hasChildren.has(n.head.id) && n.head.isActive !== 0)
      .sort((a, b) => String(a.head.code).localeCompare(String(b.head.code), undefined, { numeric: true }))
      .map((n) => n.label),
    [headTree],
  );

  // Create/Edit dialog option lists: the standard enumeration unioned with the
  // real values already in the data, plus the row's current value when editing
  // (so an existing expense whose head/office is not in the static list keeps it).
  // Dialog: chart-of-account leaf heads ("code - name"); formData.expenseHead keeps the
  // head id (or an old free-text head when editing an older expense).
  const dialogHeadOptions = useMemo(() => {
    const list = [...bookableHeadLabels];
    const current = formData.expenseHead ? headTree.labelById.get(formData.expenseHead) ?? formData.expenseHead : "";
    if (current && !list.includes(current)) list.unshift(current);
    return list;
  }, [bookableHeadLabels, formData.expenseHead, headTree]);

  const dialogOfficeOptions = useMemo(() => {
    const set = new Set<string>(OFFICES);
    for (const e of expensesList) if (e.office) set.add(e.office);
    if (formData.office) set.add(formData.office);
    return Array.from(set);
  }, [expensesList, formData.office]);

  // Total of ALL expenses matching the filters (from the server), not just this page.
  const totalAmount = parseFloat(expensePage?.totalAmount ?? "0") || 0;

  const formatCurrency = (amount: string | null, currency = "PKR") => {
    if (!amount) return "0.00";
    const num = parseFloat(amount) || 0;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2 });
  };

  const exportToCSV = async () => {
    const expensesList = await fetchAllForExport().catch(() => [] as ExpenseRow[]);
    if (expensesList.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    const headers = ["No", "Date", "Branch", "Head", "Detail", "Voucher Number", "Amount", "Currency", "Created By"];
    const rows = expensesList.map((e, i) => [
      i + 1,
      format(new Date(e.expenseDate), "yyyy-MM-dd"),
      e.office,
      e.expenseHead,
      `"${(e.detail || "").replace(/"/g, '""')}"`,
      `"${e.voucherNumber || ""}"`,
      e.amount,
      e.currency,
      `"${(e.createdByName || "System").replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "office_expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async () => {
    const expensesList = await fetchAllForExport().catch(() => [] as ExpenseRow[]);
    if (expensesList.length === 0) {
      toast({ title: "Info", description: "No data to export" });
      return;
    }
    const data = expensesList.map((e, i) => ({
      No: i + 1,
      Date: format(new Date(e.expenseDate), "yyyy-MM-dd"),
      Branch: e.office,
      Head: e.expenseHead,
      Detail: e.detail || "",
      "Voucher Number": e.voucherNumber || "",
      Amount: parseFloat(e.amount || "0"),
      Currency: e.currency,
      "Created By": e.createdByName || "System"
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Expenses");
    writeFile(wb, "office_expenses.xlsx");
  };

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-4 space-y-4 font-sans text-[#333] dark:text-zinc-300">
        
        {/* Page Title */}
        <h1 className="text-[16px] font-semibold text-[#555] uppercase mb-2">
          Expense Account
        </h1>

        {/* Filter Block */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100">
          <div className="mb-6">
            <Button 
              onClick={openCreate} 
              className="bg-[#78829d] hover:bg-[#68728c] text-white rounded-[4px] px-5 h-9 text-sm"
            >
              Add Expense
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-5">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Accounting Head<span className="text-red-500">*</span></Label>
              <MultiSelectDropdown
                options={accountingHeadOptions}
                selected={tempAccountingHead}
                onChange={setTempAccountingHead}
                placeholder="Select one or more options"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Parent Head<span className="text-red-500">*</span></Label>
              <MultiSelectDropdown
                options={parentHeadOptions}
                selected={tempParentHead}
                onChange={setTempParentHead}
                placeholder="Select one or more options"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Child Head<span className="text-red-500">*</span></Label>
              <MultiSelectDropdown
                options={childHeadOptions}
                selected={tempChildHead}
                onChange={setTempChildHead}
                placeholder="Select one or more options"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Transactional Head<span className="text-red-500">*</span></Label>
              <MultiSelectDropdown
                options={transactionalHeads}
                selected={tempTransactionalHead}
                onChange={setTempTransactionalHead}
                placeholder="Select one or more options"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Office<span className="text-red-500">*</span></Label>
              <MultiSelectDropdown
                options={FILTER_OFFICES}
                selected={tempFilterOffice}
                onChange={setTempFilterOffice}
                placeholder="Select one or more options"
              />
            </div>
            <div className="space-y-1.5 relative">
              <Label className="text-[13px] font-normal text-gray-700">Start Date<span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="h-9 border-gray-300 text-gray-500 text-[13px] rounded-[4px] pr-10"
              />
            </div>
            <div className="space-y-1.5 relative">
              <Label className="text-[13px] font-normal text-gray-700">End Date<span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="h-9 border-gray-300 text-gray-500 text-[13px] rounded-[4px] pr-10"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button 
              className="bg-[#009a54] hover:bg-[#008246] text-white rounded-[4px] px-8 h-9 text-sm font-medium"
              onClick={handleView}
            >
              View
            </Button>
            <Button 
              className="bg-[#78829d] hover:bg-[#68728c] text-white rounded-[4px] px-6 h-9 text-sm font-medium"
              onClick={handleClearFilters}
            >
              Clear Filter
            </Button>
          </div>
        </div>

        {/* List Block */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 min-h-[400px]">
          <h2 className="text-[15px] font-semibold text-[#555] mb-4">Expense List</h2>
          
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex gap-2">
              <Button 
                onClick={exportToCSV}
                className="bg-[#2bc185] hover:bg-[#25a873] text-white rounded-[4px] h-8 px-3 text-[12px] font-medium flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export to CSV
              </Button>
              <Button 
                onClick={exportToExcel}
                className="bg-[#4fb1f1] hover:bg-[#439ade] text-white rounded-[4px] h-8 px-3 text-[12px] font-medium flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Export to Excels
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500 whitespace-nowrap">Search:</span>
              <Input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Branch, head, detail, voucher, amount, user…"
                className="h-8 w-[min(100%,260px)] border-gray-300 text-[13px] rounded-[4px]"
              />
            </div>
          </div>

          <div className="w-full">
            <Table>
              <TableHeader className="bg-[#fce9e8] dark:bg-zinc-900">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10 w-12 text-center">#</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Date</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Branch</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Head</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Detail</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Voucher Number</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Amount</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10">Created By</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10 text-center">Receipt</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[12px] h-10 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500">Loading...</TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-rose-600 text-sm">Failed to load expenses. Please try again.</TableCell>
                  </TableRow>
                ) : paginatedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500 text-sm">No expenses generated yet.</TableCell>
                  </TableRow>
                ) : (
                  paginatedExpenses.map((expense, index) => (
                    <TableRow key={expense.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800">
                      <TableCell className="text-center text-[13px] text-gray-700 py-2.5">
                        {pageStart + index + 1}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {format(new Date(expense.expenseDate), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {expense.office}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {expense.expenseHead}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 max-w-[200px] truncate">
                        {expense.detail || "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {expense.voucherNumber || "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {formatCurrency(expense.amount, expense.currency)}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5">
                        {expense.createdByName || "System"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 text-center">
                        {(() => {
                          const legacy: string[] = Array.isArray((expense as any).legacyReceipts) ? (expense as any).legacyReceipts : [];
                          if (!expense.fileUrl && legacy.length === 0) return "-";
                          if (!expense.fileUrl) return <LegacyReceiptLinks files={legacy} />;
                          try {
                            const parsed = JSON.parse(expense.fileUrl);
                            if (Array.isArray(parsed)) {
                              return (
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {parsed.map((file, idx) => (
                                    <button key={idx} type="button" onClick={() => openUploadedFile(file.url, file.name)} className="inline-flex items-center gap-1 bg-white border border-[#2bc185] text-[#2bc185] hover:bg-[#2bc185] hover:text-white px-2 py-0.5 rounded text-[11px] font-medium transition-colors">
                                      <FileText className="w-3 h-3" /> {idx + 1}
                                    </button>
                                  ))}
                                </div>
                              );
                            }
                          } catch {}
                          return (
                            <button type="button" onClick={() => openUploadedFile(expense.fileUrl!)} className="inline-flex items-center gap-1 bg-white border border-[#2bc185] text-[#2bc185] hover:bg-[#2bc185] hover:text-white px-2 py-0.5 rounded text-[11px] font-medium transition-colors">
                              <FileText className="w-3 h-3" /> 1
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                          {canDeleteExpense && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              title="Delete"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this expense?")) {
                                  deleteMutation.mutate(expense.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination: 50 per page, most recent first */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 text-[12px] text-gray-500 dark:text-zinc-400">
              <span>
                {expenseTotal === 0
                  ? "Showing 0 expenses"
                  : `Showing ${(pageStart + 1).toLocaleString()} to ${(pageStart + paginatedExpenses.length).toLocaleString()} of ${expenseTotal.toLocaleString()} expenses`}
                {expensesFetching && <span className="ml-2 text-gray-400">Loading…</span>}
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded border border-gray-300 px-3 disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Previous
                </button>
                {pageButtons.map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap-${i}`} className="flex h-8 items-center px-1.5">…</span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCurrentPage(n)}
                      className={
                        n === currentPage
                          ? "h-8 min-w-8 rounded bg-[#0f8b4d] px-2 font-semibold text-white"
                          : "h-8 min-w-8 rounded border border-gray-300 px-2 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      }
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 rounded border border-gray-300 px-3 disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Table Footer */}
            <div className="flex bg-[#f8f9fa] dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
              <div className="flex-1 flex justify-end pr-10 items-center py-2">
                <span className="text-[13px] font-bold text-gray-800 mr-12">Total:</span>
                <span className="text-[13px] text-gray-800">{formatCurrency(totalAmount.toString())}</span>
              </div>
              {/* Padding to align with Action columns roughly */}
              <div className="w-[30%]"></div>
            </div>
            
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); resetForm(); } }}>
          <DialogContent className="sm:max-w-[650px] p-0 rounded-md">
            <DialogHeader className="border-b border-gray-100 p-5">
              <DialogTitle className="text-xl font-medium text-gray-700">{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Select Transactional Head:</Label>
                  <SearchableSelect
                    options={dialogHeadOptions}
                    value={formData.expenseHead ? headTree.labelById.get(formData.expenseHead) ?? formData.expenseHead : ""}
                    onChange={(v) => setFormData({ ...formData, expenseHead: headTree.idByLabel.get(v) ?? v })}
                    placeholder="Choose..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Amount:</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="h-10 border-gray-300 rounded-[4px] text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Select Office:</Label>
                  <Select
                    value={formData.office}
                    onValueChange={(v) => setFormData({ ...formData, office: v })}
                  >
                    <SelectTrigger className="h-10 border-gray-300 text-gray-600 rounded-[4px]">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent className="p-0">
                      <div className="px-3 py-2 border-b border-gray-100 text-[13px] text-gray-500 cursor-text">
                        |Choose...
                      </div>
                      {dialogOfficeOptions.map((o) => (
                        <SelectItem key={o} value={o} className="py-2 text-[13px] text-gray-700">{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Voucher Number:<span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.voucherNumber}
                    onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
                    placeholder="Enter voucher number"
                    className="h-10 border-gray-300 rounded-[4px] text-[13px]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Numbers only (e.g., 0987, 1234)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Creation Date:</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="h-10 border-gray-300 rounded-[4px] text-[13px] text-gray-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-gray-700">Select Cheque:</Label>
                  <Select
                    value={formData.chequeNumber}
                    onValueChange={(v) => setFormData({ ...formData, chequeNumber: v })}
                  >
                    <SelectTrigger className="h-10 border-gray-300 text-gray-600 rounded-[4px]">
                      <SelectValue placeholder="Choose cheque..." />
                    </SelectTrigger>
                    <SelectContent className="p-0">
                      <div className="px-3 py-2 border-b border-gray-100 text-[13px] text-gray-500 cursor-text">
                        |Choose cheque...
                      </div>
                      <div className="px-3 py-2 text-[14px] font-semibold text-gray-700 border-b border-gray-100">
                        Available Cheques
                      </div>
                      {unusedCheques.length > 0 ? unusedCheques.map((c: any) => (
                        <SelectItem key={c.id} value={c.chequeNumber || c.id} className="py-2 focus:bg-gray-50">
                          <div className="flex justify-between items-center w-[250px]">
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-gray-700 text-[13px]">{c.companyName || c.payeeName || 'Unknown'}</span>
                              <span className="text-[11px] text-gray-500 mt-1">Date: {c.chequeDate ? format(new Date(c.chequeDate), "dd-MMM-yyyy") : '-'}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[#2bc185] font-medium text-[13px]">Remaining: {c.remainingAmount ?? c.amount ?? '0.00'}</span>
                              <span className="text-[11px] text-gray-500 mt-1">Total: {c.amount ?? '0.00'}</span>
                            </div>
                          </div>
                        </SelectItem>
                      )) : (
                        <div className="p-3 text-sm text-gray-500 text-center">No unused cheques available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-gray-700">Bill/Invoice:</Label>
                {formData.files && formData.files.map((file, idx) => (
                  <div key={idx} className="flex relative items-center mb-2">
                    <div className="bg-[#f4f6f9] border border-r-0 border-gray-300 text-gray-600 px-4 py-2 text-[13px] rounded-l shrink-0 h-10 flex items-center pointer-events-none">
                      File {idx + 1}
                    </div>
                    <div className="border border-y border-gray-300 px-3 py-2 text-[13px] text-gray-500 flex-1 h-10 flex items-center bg-white dark:bg-zinc-900 truncate">
                      <button type="button" onClick={() => openUploadedFile(file.url, file.name)} className="hover:underline truncate w-full text-left text-blue-500">{file.name}</button>
                    </div>
                    <Button 
                      type="button" 
                      variant="destructive"
                      className="rounded-l-none h-10 rounded-r shrink-0 w-12"
                      onClick={() => {
                        const newFiles = [...formData.files];
                        newFiles.splice(idx, 1);
                        setFormData(prev => ({ ...prev, files: newFiles }));
                      }}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex relative">
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({ 
                            ...prev, 
                            files: [...(prev.files || []), { name: file.name, url: reader.result as string }] 
                          }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.xls,.xlsx"
                  />
                  <div className="bg-[#f4f6f9] border border-r-0 border-gray-300 text-gray-600 px-4 py-2 text-[13px] rounded-l shrink-0 h-10 flex items-center pointer-events-none">
                    Choose File
                  </div>
                  <div className="border border-gray-300 px-3 py-2 text-[13px] text-gray-500 flex-1 h-10 flex items-center bg-white dark:bg-zinc-900 truncate pointer-events-none">
                    Click to add a file
                  </div>
                  <div className="bg-[#2bc185] hover:bg-[#25a873] flex items-center justify-center w-12 rounded-r shrink-0 h-10 border border-[#2bc185] pointer-events-none">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-[12px] text-[#f26e6e] mt-1.5 leading-[1.3]">
                  Allowed file types: .jpg, .jpeg, .png, .gif, .bmp, .webp, .pdf, .xls, .xlsx<br />
                  You can upload Files upto 10MBs.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-gray-700">Detail:<span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.detail}
                  onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                  className="min-h-[80px] border-gray-300 rounded-[4px] text-[13px]"
                />
              </div>

            </div>

            <DialogFooter className="bg-[#f8f9fa] dark:bg-zinc-900 p-4 border-t border-gray-100 dark:border-zinc-800 flex gap-2 justify-end rounded-b-md sm:justify-end">
              <Button 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="bg-[#f0f1f5] text-[#333] dark:text-zinc-300 hover:bg-[#e2e4e9] border-0 h-10 px-6 font-medium text-sm rounded-[4px]"
              >
                Close
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-[#009a54] hover:bg-[#008246] h-10 px-6 font-medium text-white text-sm rounded-[4px]"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
