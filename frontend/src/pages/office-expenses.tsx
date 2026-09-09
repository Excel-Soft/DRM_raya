import { useState, useMemo } from "react";
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
import { Trash2, Pencil, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { utils, writeFile } from "xlsx";
import type { OfficeExpense } from "@shared/schema";

const OFFICES = [
  "Karachi",
  "Lahore-Raya",
  "Lahore-GulBerg",
  "Sialkot-Welc",
  "Sialkot-Webexcels",
  "Gujranwala branch"
];
const EXPENSE_HEADS = ["Rent", "Utilities", "Salaries", "Office Supplies", "Travel", "Marketing", "Maintenance", "Miscellaneous"];

const TRANSACTIONAL_HEADS = [
  "10101-1 - Petty Cash",
  "10101-2 - Cash on Hand",
  "10101-3 - Cash at Bank - Checking",
  "10101-4 - Cash in Bank - Savings",
  "10101-5 - Foreign Currency Accounts",
  "10103-1 - Advance Salary Paid to Employee",
  "10201-1 - Land",
  "10201-2 - Buildings",
  "10201-3 - Machinery and Equipment",
  "10201-4 - Leasehold Improvements"
];

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

export default function OfficeExpenses() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Temporary filter states (bound to inputs)
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempFilterOffice, setTempFilterOffice] = useState<string[]>([]);
  const [tempAccountingHead, setTempAccountingHead] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Applied filter states (used for fetching)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterOffice, setFilterOffice] = useState<string[]>([]);
  const [filterAccountingHead, setFilterAccountingHead] = useState<string[]>([]);

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
  });

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (filterOffice.length > 0 && !filterOffice.includes("all")) queryParams.set("office", filterOffice.join(","));
  if (filterAccountingHead.length > 0 && !filterAccountingHead.includes("all")) queryParams.set("accountingHead", filterAccountingHead.join(","));

  const { data: expenses = [], isLoading, isError } = useQuery<OfficeExpense[]>({
    queryKey: ["/api/office/expenses", startDate, endDate, filterOffice.join(","), filterAccountingHead.join(",")],
    queryFn: () => apiRequestJson<OfficeExpense[]>("GET", `/api/office/expenses?${queryParams.toString()}`),
  });

  const { data: cheques = [] } = useQuery<any[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: () => apiRequestJson<any[]>("GET", "/api/office/cheques"),
  });

  const unusedCheques = (Array.isArray(cheques) ? cheques : []).filter((c: any) => 
    c.status === "Pending" && parseFloat(c.remainingAmount ?? c.amount ?? "0") > 0
  );

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
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
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
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
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (expense: OfficeExpense) => {
    setEditingId(expense.id);
    setFormData({
      expenseHead: expense.expenseHead || "",
      office: expense.office || "",
      amount: expense.amount || "",
      currency: expense.currency || "PKR",
      voucherNumber: expense.voucherNumber || "",
      chequeNumber: expense.chequeNumber || "",
      detail: expense.detail || "",
      fileName: "",
      fileUrl: expense.fileUrl || "",
    });
    setDialogOpen(true);
  };

  const handleView = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setFilterOffice(tempFilterOffice);
    setFilterAccountingHead(tempAccountingHead);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setTempStartDate("");
    setTempEndDate("");
    setTempFilterOffice([]);
    setTempAccountingHead([]);

    setStartDate("");
    setEndDate("");
    setFilterOffice([]);
    setFilterAccountingHead([]);
    setCurrentPage(1);
  };

  const expensesList = Array.isArray(expenses) ? expenses : [];
  const paginatedExpenses = expensesList.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Head filter options derived from real expenseHead values present in the data
  // (unioned with any currently-selected head so the selection stays visible).
  const headFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of expensesList) {
      if (e.expenseHead) set.add(e.expenseHead);
    }
    for (const h of tempAccountingHead) {
      if (h && h !== "all") set.add(h);
    }
    return Array.from(set).sort();
  }, [expensesList, tempAccountingHead]);

  // Create/Edit dialog option lists: the standard enumeration unioned with the
  // real values already in the data, plus the row's current value when editing
  // (so an existing expense whose head/office is not in the static list keeps it).
  const dialogHeadOptions = useMemo(() => {
    const set = new Set<string>(TRANSACTIONAL_HEADS);
    for (const e of expensesList) if (e.expenseHead) set.add(e.expenseHead);
    if (formData.expenseHead) set.add(formData.expenseHead);
    return Array.from(set);
  }, [expensesList, formData.expenseHead]);

  const dialogOfficeOptions = useMemo(() => {
    const set = new Set<string>(OFFICES);
    for (const e of expensesList) if (e.office) set.add(e.office);
    if (formData.office) set.add(formData.office);
    return Array.from(set);
  }, [expensesList, formData.office]);

  const totalAmount = expensesList.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  const formatCurrency = (amount: string | null, currency = "PKR") => {
    if (!amount) return "0.00";
    const num = parseFloat(amount) || 0;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2 });
  };

  const exportToCSV = () => {
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
      "System"
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

  const exportToExcel = () => {
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
      "Created By": "System"
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
              <Label className="text-[13px] font-normal text-gray-700">Select Head</Label>
              <MultiSelectDropdown
                options={headFilterOptions}
                selected={tempAccountingHead}
                onChange={setTempAccountingHead}
                placeholder="All heads"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-normal text-gray-700">Select Office</Label>
              <MultiSelectDropdown
                options={OFFICES}
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
          
          <div className="flex gap-2 mb-4">
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
                        {(currentPage - 1) * rowsPerPage + index + 1}
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
                        System
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 text-center">
                        -
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteMutation.mutate(expense.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
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
                  <Select
                    value={formData.expenseHead}
                    onValueChange={(v) => setFormData({ ...formData, expenseHead: v })}
                  >
                    <SelectTrigger className="h-10 border-gray-300 text-gray-600 rounded-[4px]">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent className="p-0">
                      <div className="px-3 py-2 border-b border-gray-100 text-[13px] text-gray-500 cursor-text">
                        |Choose...
                      </div>
                      {dialogHeadOptions.map((h) => (
                        <SelectItem key={h} value={h} className="py-2 text-[13px] text-gray-700">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="flex relative">
                  <input 
                    type="file" 
                    id="expense-file-upload"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormData(prev => ({ ...prev, fileName: file.name }));
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({ ...prev, fileUrl: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.xls,.xlsx"
                  />
                  <div className="bg-[#f4f6f9] border border-r-0 border-gray-300 text-gray-600 px-4 py-2 text-[13px] rounded-l shrink-0 h-10 flex items-center pointer-events-none">
                    Choose Files
                  </div>
                  <div className="border border-gray-300 px-3 py-2 text-[13px] text-gray-500 flex-1 h-10 flex items-center bg-white dark:bg-zinc-900 truncate pointer-events-none">
                    {formData.fileName || "No file chosen"}
                  </div>
                  <div className="bg-[#2bc185] hover:bg-[#25a873] flex items-center justify-center w-12 rounded-r shrink-0 h-10 border border-[#2bc185] pointer-events-none">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
